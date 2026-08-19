use crate::diff::diff_for_commit;
use crate::error::Result;
use crate::git::{
    current_branch, discover, file_change_from_delta, short_oid, FileChange,
};
use git2::{Repository, Signature};
use serde::Serialize;
use std::path::{Path, PathBuf};

use super::{layout_timeline, RawCommit, RawRef, RefKind, Timeline};

const MAX_COMMITS: usize = 2500;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetail {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub body: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub committer: String,
    pub committer_email: String,
    pub committer_timestamp: i64,
    pub signed: bool,
    pub signature_kind: Option<String>,
    pub parents: Vec<String>,
    pub files: Vec<FileChange>,
}

#[allow(dead_code)]
pub fn load_timeline(path: &Path) -> Result<Timeline> {
    load_timeline_opts(path, true)
}

pub fn load_timeline_opts(path: &Path, show_upstream: bool) -> Result<Timeline> {
    let repo = discover(path)?;
    let (commits, refs, head, sacred_hint) = collect_raw(&repo, show_upstream)?;
    Ok(layout_timeline(commits, refs, head, sacred_hint))
}

pub fn load_commit(path: &Path, sha: &str) -> Result<CommitDetail> {
    let repo = discover(path)?;
    let (commit, diff) = diff_for_commit(&repo, sha)?;

    let mut files = Vec::new();
    diff.foreach(
        &mut |delta, _| {
            files.push(file_change_from_delta(&delta));
            true
        },
        None,
        None,
        None,
    )?;

    let message = commit.message().unwrap_or("").to_string();
    let summary = commit.summary().unwrap_or("").to_string();
    let body = message
        .strip_prefix(&summary)
        .unwrap_or("")
        .trim()
        .to_string();
    let author = commit.author();
    let author_name = author.name().unwrap_or("unknown").to_string();
    let email = author.email().unwrap_or("").to_string();
    let timestamp = commit.time().seconds();
    let committer = commit.committer();
    let parents: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();
    let id = commit.id().to_string();
    let (signed, signature_kind) = match repo.extract_signature(&commit.id(), None) {
        Ok((sig, _)) => (true, Some(signature_kind_of(&sig))),
        Err(_) => (false, None),
    };

    Ok(CommitDetail {
        id: id.clone(),
        short_id: short_oid(&id),
        summary,
        body,
        author: author_name,
        email,
        timestamp,
        committer: committer.name().unwrap_or("unknown").to_string(),
        committer_email: committer.email().unwrap_or("").to_string(),
        committer_timestamp: committer.when().seconds(),
        signed,
        signature_kind,
        parents,
        files,
    })
}

fn signature_kind_of(sig: &[u8]) -> String {
    let text = std::str::from_utf8(sig).unwrap_or("");
    if text.contains("SSH SIGNATURE") {
        "ssh".into()
    } else if text.contains("PGP SIGNATURE") || text.contains("PGP MESSAGE") {
        "gpg".into()
    } else {
        "unknown".into()
    }
}

pub fn create_tag(path: &Path, name: &str, sha: &str, message: Option<&str>) -> Result<()> {
    let repo = discover(path)?;
    let obj = repo.revparse_single(sha)?;
    if let Some(message) = message.filter(|m| !m.trim().is_empty()) {
        let sig = repo
            .signature()
            .or_else(|_| Signature::now("Timestream", "timestream@local"))?;
        repo.tag(name, &obj, &sig, message, false)?;
    } else {
        repo.tag_lightweight(name, &obj, false)?;
    }
    Ok(())
}

pub fn delete_tag(path: &Path, name: &str) -> Result<()> {
    let repo = discover(path)?;
    repo.tag_delete(name)?;
    Ok(())
}

fn collect_raw(
    repo: &Repository,
    show_upstream: bool,
) -> Result<(Vec<RawCommit>, Vec<RawRef>, Option<String>, Option<String>)> {
    let mut walk = repo.revwalk()?;
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;

    let mut refs = Vec::new();
    for reference in repo.references()? {
        let reference = reference?;
        if reference.is_remote() {
            if !show_upstream {
                continue;
            }
            let Ok(commit) = reference.peel_to_commit() else {
                continue;
            };
            let _ = walk.push(commit.id());
            let Some(name) = reference.shorthand() else {
                continue;
            };
            refs.push(RawRef {
                name: name.to_string(),
                target: commit.id().to_string(),
                kind: RefKind::Remote,
            });
            continue;
        }
        let Ok(commit) = reference.peel_to_commit() else {
            continue;
        };
        let _ = walk.push(commit.id());
        let Some(name) = reference.shorthand() else {
            continue;
        };
        let kind = if reference.is_branch() {
            RefKind::Branch
        } else if reference.is_tag() {
            RefKind::Tag
        } else {
            continue;
        };
        refs.push(RawRef {
            name: name.to_string(),
            target: commit.id().to_string(),
            kind,
        });
    }
    if let Ok(head) = repo.head() {
        if let Ok(commit) = head.peel_to_commit() {
            let _ = walk.push(commit.id());
        }
    }

    let mut commits = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for oid in walk {
        let oid = oid?;
        if !seen.insert(oid) {
            continue;
        }
        let commit = repo.find_commit(oid)?;
        commits.push(RawCommit {
            id: oid.to_string(),
            parents: commit.parent_ids().map(|id| id.to_string()).collect(),
            timestamp: commit.time().seconds(),
            summary: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("unknown").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
        });
        if commits.len() >= MAX_COMMITS {
            break;
        }
    }

    let head = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok())
        .map(|c| c.id().to_string());
    let sacred_hint = current_branch(repo)
        .filter(|b| b == "main" || b == "master")
        .or_else(|| {
            refs.iter()
                .find(|r| r.kind == RefKind::Branch && (r.name == "main" || r.name == "master"))
                .map(|r| r.name.clone())
        })
        .or_else(|| current_branch(repo));

    Ok((commits, refs, head, sacred_hint))
}

#[tauri::command]
pub fn get_timeline(app: tauri::AppHandle, path: String) -> Result<Timeline> {
    let show = crate::settings::load_app_settings(&app)
        .map(|s| s.timeline.show_upstream_refs)
        .unwrap_or(true);
    load_timeline_opts(&PathBuf::from(path), show)
}

#[tauri::command]
pub fn get_commit(path: String, sha: String) -> Result<CommitDetail> {
    load_commit(&PathBuf::from(path), &sha)
}

#[tauri::command]
pub fn create_local_tag(
    path: String,
    name: String,
    sha: String,
    message: Option<String>,
) -> Result<()> {
    create_tag(&PathBuf::from(path), &name, &sha, message.as_deref())
}

#[tauri::command]
pub fn delete_local_tag(path: String, name: String) -> Result<()> {
    delete_tag(&PathBuf::from(path), &name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::Harness;
    use crate::timeline::graph::tests::assert_invariants;

    #[test]
    fn load_commit_keeps_description_and_trailers() {
        let mut h = Harness::new();
        let tip = h.commit(
            "readme.txt",
            "filed",
            "File the spur\n\nKeep the river gold.\n\nCo-authored-by: B-15 <b15@tva.local>\nSigned-off-by: Analyst <analyst@tva.local>\n",
        );
        let detail = load_commit(&h.path, &tip).unwrap();
        assert_eq!(detail.summary, "File the spur");
        assert!(detail.body.contains("Keep the river gold."));
        assert!(detail.body.contains("Co-authored-by: B-15"));
        assert!(detail.body.contains("Signed-off-by: Analyst"));
    }

    #[test]
    fn many_branches_have_unique_tip_lanes() {
        let mut h = Harness::new();
        let nexus = h.commit("base.txt", "nexus", "nexus");
        h.commit("main.txt", "sacred", "sacred tip");
        for i in 1..=8 {
            h.branch_from(&format!("var-{i}"), &nexus);
            h.checkout(&format!("var-{i}"));
            h.commit(&format!("v{i}.txt"), "x", &format!("variant {i}"));
        }
        h.checkout(&h.trunk());

        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);
        assert!(tl.dossiers.len() >= 9);

        let mut cols = std::collections::HashSet::new();
        for d in tl.dossiers.iter().filter(|d| !d.is_sacred) {
            let node = tl.nodes.iter().find(|n| n.id == d.tip).unwrap();
            assert_ne!(node.column, 0, "{} stayed on sacred", d.name);
            assert!(cols.insert(node.column), "lane reuse for {}", d.name);
        }
        assert_eq!(cols.len(), 8);
    }

    #[test]
    fn long_diverged_histories_keep_stable_lanes() {
        let mut h = Harness::new();
        let root = h.commit("root.txt", "root", "root");
        for i in 1..=20 {
            h.commit("main.txt", &format!("s{i}"), &format!("sacred {i}"));
        }
        h.branch_from("long-feature", &root);
        h.checkout("long-feature");
        let mut variant_tips = Vec::new();
        for i in 1..=20 {
            variant_tips.push(h.commit(
                "feat.txt",
                &format!("v{i}"),
                &format!("variant {i}"),
            ));
        }
        h.checkout(&h.trunk());

        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);

        assert_eq!(tl.sacred_branch.as_deref(), Some(h.trunk().as_str()));
        let mut sacred_cols = std::collections::HashSet::new();
        let mut cursor = tl
            .dossiers
            .iter()
            .find(|d| d.is_sacred)
            .map(|d| d.tip.clone())
            .expect("sacred dossier");
        loop {
            let node = tl.nodes.iter().find(|n| n.id == cursor).unwrap();
            sacred_cols.insert(node.column);
            match node.parents.first() {
                Some(parent) => cursor = parent.clone(),
                None => break,
            }
        }
        assert_eq!(sacred_cols, std::collections::HashSet::from([0]));

        let variant_cols: std::collections::HashSet<_> = tl
            .nodes
            .iter()
            .filter(|n| n.summary.starts_with("variant"))
            .map(|n| n.column)
            .collect();
        assert_eq!(variant_cols.len(), 1);
        assert!(!variant_cols.contains(&0));

        let dossier = tl
            .dossiers
            .iter()
            .find(|d| d.name == "long-feature")
            .unwrap();
        assert_eq!(dossier.exclusive_commits, 20);
        assert!(dossier.commits_apart >= 40);
        assert_eq!(dossier.threat, crate::timeline::ThreatLevel::Severe);
        let _ = variant_tips;
    }

    #[test]
    fn two_short_lived_variants() {
        let mut h = Harness::new();
        let nexus = h.commit("base.txt", "nexus", "nexus");
        h.branch_from("var-a", &nexus);
        h.branch_from("var-b", &nexus);
        h.checkout("var-a");
        h.commit("a.txt", "a", "variant a");
        h.checkout("var-b");
        h.commit("b.txt", "b", "variant b");
        h.checkout(&h.trunk());

        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);
        let variants: Vec<_> = tl.dossiers.iter().filter(|d| !d.is_sacred).collect();
        assert_eq!(variants.len(), 2);
        for d in variants {
            let node = tl.nodes.iter().find(|n| n.id == d.tip).unwrap();
            assert_ne!(node.column, 0);
        }
    }

    #[test]
    fn remote_tracking_ref_appears_when_upstream_enabled() {
        let mut h = Harness::new();
        let root = h.commit("a.txt", "a", "root");
        h.branch_from("feature", &root);
        h.checkout("feature");
        let tip = h.commit("f.txt", "f", "on feature");
        let oid = git2::Oid::from_str(&tip).unwrap();
        h.repo
            .reference("refs/remotes/origin/feature", oid, true, "test remote")
            .unwrap();

        let hidden = load_timeline_opts(&h.path, false).unwrap();
        assert!(!hidden.nodes.iter().any(|n| {
            n.refs
                .iter()
                .any(|r| r.kind == crate::timeline::RefKind::Remote)
        }));

        let shown = load_timeline_opts(&h.path, true).unwrap();
        assert_invariants(&shown);
        assert!(shown.nodes.iter().any(|n| {
            n.refs.iter().any(|r| {
                r.kind == crate::timeline::RefKind::Remote && r.name == "origin/feature"
            })
        }));
    }

    #[test]
    fn create_and_delete_lightweight_tag() {
        let mut h = Harness::new();
        let tip = h.commit("a.txt", "a", "root");
        create_tag(&h.path, "v1.0", &tip, None).unwrap();
        let tl = load_timeline(&h.path).unwrap();
        assert!(tl
            .nodes
            .iter()
            .any(|n| n.refs.iter().any(|r| r.name == "v1.0")));
        delete_tag(&h.path, "v1.0").unwrap();
        let after = load_timeline(&h.path).unwrap();
        assert!(!after
            .nodes
            .iter()
            .any(|n| n.refs.iter().any(|r| r.name == "v1.0")));
    }
}
