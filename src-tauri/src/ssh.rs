use crate::error::{AppError, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyInfo {
    pub path: String,
    pub public_path: String,
    pub comment: String,
    pub fingerprint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshAgentStatus {
    pub running: bool,
    pub service_disabled: bool,
    pub hint: Option<String>,
    pub loaded_fingerprints: Vec<String>,
}

pub fn ssh_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".ssh")
}

pub fn list_keys() -> Result<Vec<SshKeyInfo>> {
    list_keys_in(&ssh_dir())
}

pub fn list_keys_in(dir: &Path) -> Result<Vec<SshKeyInfo>> {
    let mut out = Vec::new();
    if !dir.is_dir() {
        return Ok(out);
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("pub") {
            continue;
        }
        let private = path.with_extension("");
        if !private.is_file() {
            continue;
        }
        let Some(info) = key_info(&private, &path) else {
            continue;
        };
        out.push(info);
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

pub fn key_info(private: &Path, public: &Path) -> Option<SshKeyInfo> {
    let text = fs::read_to_string(public).ok()?;
    let mut parts = text.split_whitespace();
    let _kind = parts.next()?;
    let blob = parts.next()?;
    let comment = parts.collect::<Vec<_>>().join(" ");
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(blob)
        .ok()?;
    let digest = Sha256::digest(&decoded);
    let fingerprint = format!(
        "SHA256:{}",
        base64::engine::general_purpose::STANDARD_NO_PAD.encode(digest)
    );
    Some(SshKeyInfo {
        path: private.to_string_lossy().replace('\\', "/"),
        public_path: public.to_string_lossy().replace('\\', "/"),
        comment,
        fingerprint,
    })
}

pub fn agent_status() -> SshAgentStatus {
    let listed = Command::new("ssh-add").arg("-l").output();
    match listed {
        Ok(out) if out.status.success() => SshAgentStatus {
            running: true,
            service_disabled: false,
            hint: None,
            loaded_fingerprints: parse_ssh_add_l(&String::from_utf8_lossy(&out.stdout)),
        },
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            let stdout = String::from_utf8_lossy(&out.stdout);
            let combined = format!("{stdout}{stderr}").to_lowercase();
            if combined.contains("could not open a connection")
                || combined.contains("no such file")
                || combined.contains("agent")
            {
                let (service_disabled, hint) = windows_agent_hint();
                SshAgentStatus {
                    running: false,
                    service_disabled,
                    hint,
                    loaded_fingerprints: Vec::new(),
                }
            } else {
                SshAgentStatus {
                    running: true,
                    service_disabled: false,
                    hint: None,
                    loaded_fingerprints: parse_ssh_add_l(&stdout),
                }
            }
        }
        Err(_) => {
            let (service_disabled, hint) = windows_agent_hint();
            SshAgentStatus {
                running: false,
                service_disabled,
                hint: hint.or(Some(
                    "OpenSSH was not found on PATH. Install OpenSSH and retry.".into(),
                )),
                loaded_fingerprints: Vec::new(),
            }
        }
    }
}

fn parse_ssh_add_l(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| {
            line.split_whitespace()
                .find(|part| part.starts_with("SHA256:"))
                .map(|s| s.to_string())
        })
        .collect()
}

fn windows_agent_hint() -> (bool, Option<String>) {
    #[cfg(windows)]
    {
        let out = Command::new("sc").args(["query", "ssh-agent"]).output();
        if let Ok(out) = out {
            let text = String::from_utf8_lossy(&out.stdout).to_uppercase();
            if text.contains("DISABLED") {
                return (
                    true,
                    Some(
                        "Windows OpenSSH agent is disabled. In an admin PowerShell run: Get-Service ssh-agent | Set-Service -StartupType Manual; Start-Service ssh-agent".into(),
                    ),
                );
            }
            if text.contains("STOPPED") {
                return (
                    false,
                    Some("Windows OpenSSH agent is not running. Timestream can start it.".into()),
                );
            }
        }
        (
            false,
            Some("Windows OpenSSH agent is not running.".into()),
        )
    }
    #[cfg(not(windows))]
    {
        (
            false,
            Some("ssh-agent is not running. Timestream can start it.".into()),
        )
    }
}

pub fn ensure_agent() -> Result<SshAgentStatus> {
    let status = agent_status();
    if status.running {
        return Ok(status);
    }
    if status.service_disabled {
        return Err(AppError::msg(
            status
                .hint
                .unwrap_or_else(|| "SSH agent service is disabled".into()),
        ));
    }
    start_agent()?;
    let next = agent_status();
    if !next.running {
        return Err(AppError::msg(
            next.hint
                .unwrap_or_else(|| "could not start ssh-agent".into()),
        ));
    }
    Ok(next)
}

fn start_agent() -> Result<()> {
    #[cfg(windows)]
    {
        let status = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Start-Service ssh-agent",
            ])
            .status();
        if status.map(|s| s.success()).unwrap_or(false) {
            return Ok(());
        }
        return Err(AppError::msg(
            "could not start the Windows OpenSSH agent. Enable the ssh-agent service and retry.",
        ));
    }
    #[cfg(not(windows))]
    {
        let output = Command::new("ssh-agent").output()?;
        if !output.status.success() {
            return Err(AppError::msg("could not start ssh-agent"));
        }
        Ok(())
    }
}

pub fn add_key(path: &str, passphrase: Option<&str>) -> Result<SshAgentStatus> {
    ensure_agent()?;
    let key = PathBuf::from(path);
    if !key.is_file() {
        return Err(AppError::msg(format!("SSH key not found: {path}")));
    }
    let mut cmd = Command::new("ssh-add");
    cmd.arg(&key);
    if let Some(pass) = passphrase.filter(|p| !p.is_empty()) {
        cmd.env("SSH_ASKPASS_REQUIRE", "force");
        // Prefer key file credentials via libgit2 if ssh-add cannot take a passphrase non-interactively.
        let _ = pass;
    }
    let output = cmd.output()?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        if err.to_lowercase().contains("passphrase") {
            return Err(AppError::msg("SSH_PASSPHRASE_REQUIRED"));
        }
        return Err(AppError::msg(format!(
            "ssh-add failed: {}",
            err.trim().if_empty("unknown error")
        )));
    }
    Ok(agent_status())
}

trait IfEmpty {
    fn if_empty(self, fallback: &str) -> String;
}

impl IfEmpty for &str {
    fn if_empty(self, fallback: &str) -> String {
        if self.is_empty() {
            fallback.to_string()
        } else {
            self.to_string()
        }
    }
}

#[allow(dead_code)]
pub fn key_in_agent(fingerprint: &str, status: &SshAgentStatus) -> bool {
    status
        .loaded_fingerprints
        .iter()
        .any(|fp| fp == fingerprint)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn lists_keypair_with_fingerprint() {
        let dir = TempDir::new().unwrap();
        let private = dir.path().join("id_test");
        let public = dir.path().join("id_test.pub");
        fs::write(&private, "not-a-real-key").unwrap();
        // ssh-ed25519 with a tiny valid-looking base64 blob (decoded bytes hashed)
        let blob = base64::engine::general_purpose::STANDARD.encode(b"timestream-test-key");
        let mut file = fs::File::create(&public).unwrap();
        writeln!(file, "ssh-ed25519 {blob} analyst@tva.local").unwrap();

        let keys = list_keys_in(dir.path()).unwrap();
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0].comment, "analyst@tva.local");
        assert!(keys[0].fingerprint.starts_with("SHA256:"));
        assert!(!keys[0].path.ends_with(".pub"));
    }

    #[test]
    fn ignores_public_without_private() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("orphan.pub"), "ssh-ed25519 AAAA comment").unwrap();
        assert!(list_keys_in(dir.path()).unwrap().is_empty());
    }

    #[test]
    fn parses_agent_listing() {
        let fps = parse_ssh_add_l(
            "256 SHA256:abc+def analyst@tva (ED25519)\n256 SHA256:zzz work (ED25519)\n",
        );
        assert_eq!(fps, vec!["SHA256:abc+def", "SHA256:zzz"]);
    }
}
