use crate::error::{AppError, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::ffi::OsStr;
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

fn hidden_command(program: impl AsRef<OsStr>) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd
}

fn ssh_add_command() -> Command {
    #[cfg(windows)]
    {
        if let Some(path) = windows_openssh_bin("ssh-add.exe") {
            let mut cmd = hidden_command(path);
            // Windows OpenSSH uses \\.\pipe\openssh-ssh-agent. Git for Windows often
            // leaves a stale cygwin SSH_AUTH_SOCK that the real ssh-add will chase.
            cmd.env_remove("SSH_AUTH_SOCK");
            cmd.env_remove("SSH_AGENT_PID");
            return cmd;
        }
        return hidden_command("ssh-add.exe");
    }
    #[cfg(not(windows))]
    hidden_command("ssh-add")
}

#[cfg(windows)]
fn windows_openssh_bin(exe: &str) -> Option<PathBuf> {
    let root = PathBuf::from(std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()));
    for dir in ["System32", "Sysnative"] {
        let path = root.join(dir).join("OpenSSH").join(exe);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

struct AgentProbe {
    running: bool,
    fingerprints: Vec<String>,
}

fn interpret_ssh_add_output(code: Option<i32>, stdout: &str, stderr: &str) -> AgentProbe {
    let fingerprints = parse_ssh_add_l(stdout);
    let lower = format!("{stdout}{stderr}").to_lowercase();
    let unreachable = code == Some(2)
        || lower.contains("could not open a connection")
        || lower.contains("error connecting to agent")
        || lower.contains("connection refused")
        || lower.contains("failed to connect");
    if unreachable {
        return AgentProbe {
            running: false,
            fingerprints: Vec::new(),
        };
    }
    // ssh-add -l: 0 = identities listed, 1 = agent reachable but empty.
    // Do not treat "The agent has no identities" as a dead agent.
    if code == Some(0)
        || code == Some(1)
        || lower.contains("no identities")
        || !fingerprints.is_empty()
    {
        return AgentProbe {
            running: true,
            fingerprints,
        };
    }
    AgentProbe {
        running: false,
        fingerprints: Vec::new(),
    }
}

pub fn agent_status() -> SshAgentStatus {
    match ssh_add_command().arg("-l").output() {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            let probe = interpret_ssh_add_output(out.status.code(), &stdout, &stderr);
            if probe.running {
                SshAgentStatus {
                    running: true,
                    service_disabled: false,
                    hint: None,
                    loaded_fingerprints: probe.fingerprints,
                }
            } else {
                let (service_disabled, hint) = windows_agent_hint();
                SshAgentStatus {
                    running: false,
                    service_disabled,
                    hint,
                    loaded_fingerprints: Vec::new(),
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
        let query = sc_text(&["query", "ssh-agent"]);
        if query.contains("1060") || query.contains("DOES NOT EXIST") {
            return (
                false,
                Some(
                    "Windows OpenSSH agent is not installed. Add OpenSSH Authentication Agent in Optional Features.".into(),
                ),
            );
        }
        if sc_text(&["qc", "ssh-agent"]).contains("DISABLED") {
            return (
                true,
                Some(
                    "Windows OpenSSH agent is disabled. Timestream can enable and start it (administrator prompt).".into(),
                ),
            );
        }
        if query.contains("RUNNING") {
            return (
                false,
                Some(
                    "OpenSSH agent service is running but ssh-add could not connect. Use the Windows OpenSSH client, not Git's ssh-add.".into(),
                ),
            );
        }
        (
            false,
            Some("Windows OpenSSH agent is not running. Timestream can start it.".into()),
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

#[cfg(windows)]
fn sc_text(args: &[&str]) -> String {
    hidden_command("sc.exe")
        .args(args)
        .output()
        .map(|out| {
            format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            )
            .to_uppercase()
        })
        .unwrap_or_default()
}

pub fn ensure_agent() -> Result<SshAgentStatus> {
    let status = agent_status();
    if status.running {
        return Ok(status);
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
        if try_start_ssh_agent_service(false) && wait_for_agent() {
            return Ok(());
        }
        if try_start_ssh_agent_service(true) && wait_for_agent() {
            return Ok(());
        }
        return Err(AppError::msg(
            "Could not start the Windows OpenSSH agent. Approve the administrator prompt, or enable the ssh-agent service and retry.",
        ));
    }
    #[cfg(not(windows))]
    {
        let output = hidden_command("ssh-agent").output()?;
        if !output.status.success() {
            return Err(AppError::msg("could not start ssh-agent"));
        }
        Ok(())
    }
}

#[cfg(windows)]
fn wait_for_agent() -> bool {
    for _ in 0..25 {
        if agent_status().running {
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(80));
    }
    false
}

#[cfg(windows)]
fn try_start_ssh_agent_service(elevate: bool) -> bool {
    if elevate {
        // UAC: set Manual (if Disabled) then start. -Wait blocks until the prompt is handled.
        let status = hidden_command("powershell.exe")
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                "Start-Process -FilePath powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-WindowStyle','Hidden','-Command','Set-Service -Name ssh-agent -StartupType Manual; Start-Service ssh-agent'",
            ])
            .status();
        return status.map(|s| s.success()).unwrap_or(false);
    }
    let Ok(out) = hidden_command("sc.exe").args(["start", "ssh-agent"]).output() else {
        return false;
    };
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
    .to_uppercase();
    out.status.success() || text.contains("1056") || text.contains("ALREADY RUNNING")
}

pub fn add_key(path: &str, passphrase: Option<&str>) -> Result<SshAgentStatus> {
    ensure_agent()?;
    let key = PathBuf::from(path);
    if !key.is_file() {
        return Err(AppError::msg(format!("SSH key not found: {path}")));
    }
    let mut cmd = ssh_add_command();
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

    #[test]
    fn empty_agent_is_running() {
        let probe = interpret_ssh_add_output(Some(1), "The agent has no identities.\n", "");
        assert!(probe.running);
        assert!(probe.fingerprints.is_empty());
    }

    #[test]
    fn listed_identities_are_running() {
        let probe = interpret_ssh_add_output(
            Some(0),
            "256 SHA256:abc+def analyst@tva (ED25519)\n",
            "",
        );
        assert!(probe.running);
        assert_eq!(probe.fingerprints, vec!["SHA256:abc+def"]);
    }

    #[test]
    fn unreachable_agent_is_not_running() {
        let probe = interpret_ssh_add_output(
            Some(2),
            "",
            "Could not open a connection to your authentication agent.\n",
        );
        assert!(!probe.running);
        let pipe = interpret_ssh_add_output(
            Some(2),
            "",
            "Error connecting to agent: No such file or directory\n",
        );
        assert!(!pipe.running);
    }
}
