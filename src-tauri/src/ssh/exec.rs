//! OpenSSH smart transport for libgit2.
//!
//! libssh2 (git2's default SSH backend) often fails Windows OpenSSH handshakes
//! with "failed to start SSH session". Spawning the system `ssh` client uses
//! the same agent Timestream already starts.

use crate::ssh;
use git2::transport::{Service, SmartSubtransport, SmartSubtransportStream, Transport};
use git2::{Error as GitError, Remote};
use std::cell::RefCell;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout, Stdio};
use std::sync::Once;

thread_local! {
    static IDENTITY: RefCell<Option<PathBuf>> = RefCell::new(None);
}

pub fn ensure_registered() {
    static ONCE: Once = Once::new();
    ONCE.call_once(|| unsafe {
        let _ = git2::transport::register("ssh", |remote: &Remote<'_>| {
            Transport::smart(remote, false, OpensshSubtransport)
        });
    });
}

pub fn with_identity<T>(
    key: Option<&Path>,
    body: impl FnOnce() -> crate::error::Result<T>,
) -> crate::error::Result<T> {
    ensure_registered();
    IDENTITY.with(|slot| {
        *slot.borrow_mut() = key.map(Path::to_path_buf);
    });
    let result = body();
    IDENTITY.with(|slot| {
        *slot.borrow_mut() = None;
    });
    result
}

fn current_key() -> Option<PathBuf> {
    IDENTITY.with(|slot| slot.borrow().clone())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SshTarget {
    pub username: String,
    pub host: String,
    pub port: Option<u16>,
    pub path: String,
}

pub fn parse_ssh_target(url: &str) -> Option<SshTarget> {
    let trimmed = url.trim();
    if let Some(rest) = trimmed
        .strip_prefix("ssh://")
        .or_else(|| trimmed.strip_prefix("SSH://"))
        .or_else(|| trimmed.strip_prefix("ssh+git://"))
        .or_else(|| trimmed.strip_prefix("git+ssh://"))
    {
        return parse_ssh_url(rest);
    }
    if let Some(rest) = trimmed.strip_prefix("git@") {
        let (host, path) = rest.split_once(':')?;
        if host.is_empty() || path.is_empty() {
            return None;
        }
        return Some(SshTarget {
            username: "git".into(),
            host: host.to_string(),
            port: None,
            path: normalize_pack_path(path),
        });
    }
    None
}

fn parse_ssh_url(rest: &str) -> Option<SshTarget> {
    let rest = rest.trim_start_matches('/');
    let (auth_host, path) = rest.split_once('/')?;
    if path.is_empty() {
        return None;
    }
    let (username, hostport) = match auth_host.split_once('@') {
        Some((user, hostport)) if !user.is_empty() => (user, hostport),
        _ => ("git", auth_host),
    };
    let (host, port) = split_host_port(hostport)?;
    Some(SshTarget {
        username: username.to_string(),
        host,
        port,
        path: normalize_pack_path(path),
    })
}

fn split_host_port(hostport: &str) -> Option<(String, Option<u16>)> {
    if hostport.starts_with('[') {
        let end = hostport.find(']')?;
        let host = hostport[1..end].to_string();
        let port = if hostport[end + 1..].starts_with(':') {
            Some(hostport[end + 2..].parse().ok()?)
        } else {
            None
        };
        return Some((host, port));
    }
    match hostport.rsplit_once(':') {
        Some((host, port)) if !host.is_empty() && port.chars().all(|c| c.is_ascii_digit()) => {
            Some((host.to_string(), Some(port.parse().ok()?)))
        }
        _ => Some((hostport.to_string(), None)),
    }
}

fn normalize_pack_path(path: &str) -> String {
    let path = path.trim().trim_end_matches('/');
    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    }
}

fn service_command(service: Service) -> &'static str {
    match service {
        Service::UploadPackLs | Service::UploadPack => "git-upload-pack",
        Service::ReceivePackLs | Service::ReceivePack => "git-receive-pack",
    }
}

pub fn ssh_args(target: &SshTarget, service: Service, key: Option<&Path>) -> Vec<String> {
    let command = service_command(service);
    let mut args = vec![
        "-o".into(),
        "BatchMode=yes".into(),
        "-o".into(),
        "StrictHostKeyChecking=accept-new".into(),
        "-o".into(),
        "PreferredAuthentications=publickey".into(),
    ];
    if let Some(key) = key {
        args.push("-o".into());
        args.push("IdentitiesOnly=yes".into());
        args.push("-i".into());
        args.push(key.to_string_lossy().into_owned());
    }
    if let Some(port) = target.port {
        args.push("-p".into());
        args.push(port.to_string());
    }
    args.push(format!("{}@{}", target.username, target.host));
    args.push(format!(
        "{command} '{}'",
        target.path.replace('\'', "'\\''")
    ));
    args
}

struct OpensshSubtransport;

impl SmartSubtransport for OpensshSubtransport {
    fn action(
        &self,
        url: &str,
        service: Service,
    ) -> Result<Box<dyn SmartSubtransportStream>, GitError> {
        match service {
            Service::UploadPackLs | Service::ReceivePackLs => {
                let stream = spawn_ssh(url, service)?;
                Ok(Box::new(stream))
            }
            Service::UploadPack | Service::ReceivePack => Err(GitError::from_str(
                "OpenSSH transport reused a closed session",
            )),
        }
    }

    fn close(&self) -> Result<(), GitError> {
        Ok(())
    }
}

fn spawn_ssh(url: &str, service: Service) -> Result<SshStream, GitError> {
    let target = parse_ssh_target(url)
        .ok_or_else(|| GitError::from_str(&format!("unsupported SSH URL: {url}")))?;
    let key = current_key();
    let args = ssh_args(&target, service, key.as_deref());
    let mut cmd = ssh::ssh_command();
    cmd.args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|err| {
        GitError::from_str(&format!(
            "could not start ssh: {err}. Install OpenSSH and retry."
        ))
    })?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| GitError::from_str("ssh stdin was not piped"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| GitError::from_str("ssh stdout was not piped"))?;
    let stderr = child.stderr.take();
    Ok(SshStream {
        child: Some(child),
        stdin: Some(stdin),
        stdout,
        stderr,
    })
}

struct SshStream {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    stdout: ChildStdout,
    stderr: Option<ChildStderr>,
}

impl SshStream {
    fn failure_if_dead(&mut self) -> Option<io::Error> {
        let status = self.child.as_mut()?.try_wait().ok().flatten()?;
        if status.success() {
            return None;
        }
        let mut err = String::new();
        if let Some(ref mut stderr) = self.stderr {
            let _ = stderr.read_to_string(&mut err);
        }
        let msg = err.trim();
        Some(io::Error::other(if msg.is_empty() {
            format!("ssh exited with {status}")
        } else {
            msg.to_string()
        }))
    }
}

impl Read for SshStream {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        match self.stdout.read(buf) {
            Ok(0) => {
                if let Some(err) = self.failure_if_dead() {
                    Err(err)
                } else {
                    Ok(0)
                }
            }
            Ok(n) => Ok(n),
            Err(err) => {
                if let Some(ssh_err) = self.failure_if_dead() {
                    Err(ssh_err)
                } else {
                    Err(err)
                }
            }
        }
    }
}

impl Write for SshStream {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.stdin
            .as_mut()
            .ok_or_else(|| io::Error::new(io::ErrorKind::BrokenPipe, "ssh stdin closed"))?
            .write(buf)
    }

    fn flush(&mut self) -> io::Result<()> {
        if let Some(stdin) = self.stdin.as_mut() {
            stdin.flush()
        } else {
            Ok(())
        }
    }
}

impl Drop for SshStream {
    fn drop(&mut self) {
        self.stdin.take();
        if let Some(mut child) = self.child.take() {
            let _ = child.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_scp_syntax() {
        let t = parse_ssh_target("git@github.com:acme/timestream.git").unwrap();
        assert_eq!(t.username, "git");
        assert_eq!(t.host, "github.com");
        assert_eq!(t.port, None);
        assert_eq!(t.path, "/acme/timestream.git");
    }

    #[test]
    fn parses_ssh_url_with_port() {
        let t = parse_ssh_target("ssh://git@github.com:22/acme/timestream.git").unwrap();
        assert_eq!(t.host, "github.com");
        assert_eq!(t.port, Some(22));
        assert_eq!(t.path, "/acme/timestream.git");
    }

    #[test]
    fn argv_uses_key_and_identities_only() {
        let target = parse_ssh_target("git@github.com:acme/app.git").unwrap();
        let args = ssh_args(
            &target,
            Service::UploadPackLs,
            Some(Path::new("C:/Users/me/.ssh/id_ed25519")),
        );
        assert!(args.contains(&"-i".into()));
        assert!(args.contains(&"IdentitiesOnly=yes".into()));
        assert!(args.contains(&"git@github.com".into()));
        assert_eq!(args.last().unwrap(), "git-upload-pack '/acme/app.git'");
    }

    #[test]
    fn receive_pack_uses_receive_command() {
        let target = parse_ssh_target("ssh://git@github.com/acme/app.git").unwrap();
        let args = ssh_args(&target, Service::ReceivePackLs, None);
        assert_eq!(args.last().unwrap(), "git-receive-pack '/acme/app.git'");
        assert!(!args.contains(&"-i".into()));
    }

    #[test]
    fn https_is_not_ssh() {
        assert!(parse_ssh_target("https://github.com/acme/timestream.git").is_none());
    }
}
