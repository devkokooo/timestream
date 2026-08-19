use serde::Serialize;
use std::collections::{BTreeSet, HashMap, HashSet};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RefKind {
    Branch,
    Tag,
    Head,
    Remote,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RefLabel {
    pub name: String,
    pub kind: RefKind,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EdgeKind {
    FirstParent,
    Merge,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ThreatLevel {
    Low,
    Moderate,
    Severe,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TimelineNode {
    pub id: String,
    pub short_id: String,
    pub parents: Vec<String>,
    pub summary: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub column: i32,
    pub row: u32,
    pub refs: Vec<RefLabel>,
    pub is_head: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEdge {
    pub from: String,
    pub to: String,
    pub kind: EdgeKind,
    pub from_column: i32,
    pub to_column: i32,
    pub from_row: u32,
    pub to_row: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VariantDossier {
    pub name: String,
    pub tip: String,
    pub is_sacred: bool,
    pub is_head: bool,
    pub exclusive_commits: u32,
    pub diverge_row: Option<u32>,
    pub commits_apart: u32,
    pub threat: ThreatLevel,
    pub is_upstream: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub nodes: Vec<TimelineNode>,
    pub edges: Vec<TimelineEdge>,
    pub sacred_branch: Option<String>,
    pub head: Option<String>,
    pub dossiers: Vec<VariantDossier>,
}

#[derive(Debug, Clone)]
pub struct RawCommit {
    pub id: String,
    pub parents: Vec<String>,
    pub timestamp: i64,
    pub summary: String,
    pub author: String,
    pub email: String,
}

#[derive(Debug, Clone)]
pub struct RawRef {
    pub name: String,
    pub target: String,
    pub kind: RefKind,
}

pub fn layout_timeline(
    commits: Vec<RawCommit>,
    refs: Vec<RawRef>,
    head: Option<String>,
    sacred_hint: Option<String>,
) -> Timeline {
    if commits.is_empty() {
        return Timeline {
            nodes: Vec::new(),
            edges: Vec::new(),
            sacred_branch: sacred_hint,
            head,
            dossiers: Vec::new(),
        };
    }

    let by_id: HashMap<String, RawCommit> =
        commits.into_iter().map(|c| (c.id.clone(), c)).collect();

    let sacred_branch = pick_sacred(&refs, sacred_hint.as_deref());
    let sacred_tip = sacred_branch
        .as_ref()
        .and_then(|name| {
            refs.iter()
                .find(|r| r.kind == RefKind::Branch && r.name == *name)
                .map(|r| r.target.clone())
        })
        .or_else(|| head.clone());

    let oldest_first = time_topo_oldest_first(&by_id);
    let row_of: HashMap<String, u32> = oldest_first
        .iter()
        .enumerate()
        .map(|(i, id)| (id.clone(), i as u32))
        .collect();

    let raw_columns = assign_lanes(&oldest_first, &by_id, &refs, sacred_tip.as_deref());
    let signed = remap_columns(&raw_columns, &row_of, sacred_tip.as_deref());

    let mut refs_by_target: HashMap<String, Vec<RefLabel>> = HashMap::new();
    for r in &refs {
        refs_by_target
            .entry(r.target.clone())
            .or_default()
            .push(RefLabel {
                name: r.name.clone(),
                kind: r.kind.clone(),
            });
    }
    if let Some(h) = &head {
        let labels = refs_by_target.entry(h.clone()).or_default();
        if !labels.iter().any(|l| l.kind == RefKind::Head) {
            labels.push(RefLabel {
                name: "HEAD".into(),
                kind: RefKind::Head,
            });
        }
    }

    let mut nodes: Vec<TimelineNode> = oldest_first
        .iter()
        .filter_map(|id| by_id.get(id).map(|c| (id, c)))
        .map(|(id, c)| TimelineNode {
            short_id: short_id(id),
            id: id.clone(),
            parents: c.parents.clone(),
            summary: c.summary.clone(),
            author: c.author.clone(),
            email: c.email.clone(),
            timestamp: c.timestamp,
            column: signed.get(id).copied().unwrap_or(0),
            row: row_of.get(id).copied().unwrap_or(0),
            refs: refs_by_target.remove(id).unwrap_or_default(),
            is_head: head.as_deref() == Some(id.as_str()),
        })
        .collect();
    nodes.sort_by_key(|n| (n.row, n.column));

    let node_index: HashMap<&str, &TimelineNode> =
        nodes.iter().map(|n| (n.id.as_str(), n)).collect();

    let mut edges = Vec::new();
    for node in &nodes {
        for (i, parent) in node.parents.iter().enumerate() {
            let Some(from) = node_index.get(parent.as_str()) else {
                continue;
            };
            edges.push(TimelineEdge {
                from: parent.clone(),
                to: node.id.clone(),
                kind: if i == 0 {
                    EdgeKind::FirstParent
                } else {
                    EdgeKind::Merge
                },
                from_column: from.column,
                to_column: node.column,
                from_row: from.row,
                to_row: node.row,
            });
        }
    }

    let dossiers = build_dossiers(
        &refs,
        &by_id,
        &row_of,
        sacred_branch.as_deref(),
        head.as_deref(),
    );

    Timeline {
        nodes,
        edges,
        sacred_branch,
        head,
        dossiers,
    }
}

fn short_id(id: &str) -> String {
    id.chars().take(7).collect()
}

fn pick_sacred(refs: &[RawRef], hint: Option<&str>) -> Option<String> {
    let branches: Vec<&RawRef> = refs.iter().filter(|r| r.kind == RefKind::Branch).collect();
    for preferred in ["main", "master"] {
        if branches.iter().any(|r| r.name == preferred) {
            return Some(preferred.to_string());
        }
    }
    if let Some(hint) = hint {
        if branches.iter().any(|r| r.name == hint) {
            return Some(hint.to_string());
        }
    }
    branches.first().map(|r| r.name.clone())
}

fn time_topo_oldest_first(by_id: &HashMap<String, RawCommit>) -> Vec<String> {
    let mut children: HashMap<String, Vec<String>> = HashMap::new();
    let mut remaining: HashMap<String, usize> = HashMap::new();

    for (id, commit) in by_id {
        let parents_in_graph = commit
            .parents
            .iter()
            .filter(|p| by_id.contains_key(*p))
            .count();
        remaining.insert(id.clone(), parents_in_graph);
        for parent in &commit.parents {
            if by_id.contains_key(parent) {
                children.entry(parent.clone()).or_default().push(id.clone());
            }
        }
    }

    let mut ready: BTreeSet<(i64, String)> = BTreeSet::new();
    for (id, count) in &remaining {
        if *count == 0 {
            let ts = by_id[id].timestamp;
            ready.insert((ts, id.clone()));
        }
    }

    let mut out = Vec::with_capacity(by_id.len());
    while let Some((_, id)) = ready.pop_first() {
        out.push(id.clone());
        if let Some(kids) = children.get(&id) {
            for child in kids {
                if let Some(left) = remaining.get_mut(child) {
                    *left = left.saturating_sub(1);
                    if *left == 0 {
                        ready.insert((by_id[child].timestamp, child.clone()));
                    }
                }
            }
        }
    }

    if out.len() < by_id.len() {
        let mut leftover: Vec<_> = by_id
            .keys()
            .filter(|id| !out.contains(id))
            .cloned()
            .collect();
        leftover.sort_by_key(|id| (by_id[id].timestamp, id.clone()));
        out.extend(leftover);
    }
    out
}

fn assign_lanes(
    oldest_first: &[String],
    by_id: &HashMap<String, RawCommit>,
    refs: &[RawRef],
    sacred_tip: Option<&str>,
) -> HashMap<String, usize> {
    let mut tips = Vec::new();
    let mut seen = HashSet::new();
    if let Some(tip) = sacred_tip {
        if by_id.contains_key(tip) && seen.insert(tip.to_string()) {
            tips.push(tip.to_string());
        }
    }
    for r in refs {
        if matches!(r.kind, RefKind::Branch | RefKind::Remote)
            && by_id.contains_key(&r.target)
            && seen.insert(r.target.clone())
        {
            tips.push(r.target.clone());
        }
    }

    let mut lanes: Vec<Option<String>> = tips.into_iter().map(Some).collect();
    let mut column_of = HashMap::new();

    for id in oldest_first.iter().rev() {
        let occupying: Vec<usize> = lanes
            .iter()
            .enumerate()
            .filter(|(_, occupant)| occupant.as_deref() == Some(id.as_str()))
            .map(|(i, _)| i)
            .collect();

        let primary = if occupying.is_empty() {
            if let Some(empty) = lanes.iter().position(|lane| lane.is_none()) {
                lanes[empty] = Some(id.clone());
                empty
            } else {
                lanes.push(Some(id.clone()));
                lanes.len() - 1
            }
        } else {
            occupying[0]
        };

        for extra in occupying.into_iter().skip(1) {
            lanes[extra] = None;
        }

        column_of.insert(id.clone(), primary);

        let parents_in_graph: Vec<String> = by_id
            .get(id)
            .map(|c| {
                c.parents
                    .iter()
                    .filter(|p| by_id.contains_key(*p))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default();

        if parents_in_graph.is_empty() {
            lanes[primary] = None;
        } else {
            lanes[primary] = Some(parents_in_graph[0].clone());
            for parent in parents_in_graph.into_iter().skip(1) {
                if lanes
                    .iter()
                    .any(|lane| lane.as_deref() == Some(parent.as_str()))
                {
                    continue;
                }
                if let Some(empty) = lanes.iter().position(|lane| lane.is_none()) {
                    lanes[empty] = Some(parent);
                } else {
                    lanes.push(Some(parent));
                }
            }
        }
    }

    column_of
}

fn remap_columns(
    raw: &HashMap<String, usize>,
    row_of: &HashMap<String, u32>,
    sacred_tip: Option<&str>,
) -> HashMap<String, i32> {
    let sacred_raw = sacred_tip
        .and_then(|tip| raw.get(tip).copied())
        .unwrap_or(0);

    let mut min_row_by_col: HashMap<usize, u32> = HashMap::new();
    for (id, col) in raw {
        let row = row_of.get(id).copied().unwrap_or(0);
        min_row_by_col
            .entry(*col)
            .and_modify(|r| *r = (*r).min(row))
            .or_insert(row);
    }

    let mut others: Vec<usize> = min_row_by_col
        .keys()
        .copied()
        .filter(|col| *col != sacred_raw)
        .collect();
    others.sort_by_key(|col| (min_row_by_col[col], *col));

    let mut remap = HashMap::from([(sacred_raw, 0)]);
    for (i, col) in others.into_iter().enumerate() {
        let magnitude = (i / 2 + 1) as i32;
        remap.insert(col, if i % 2 == 0 { magnitude } else { -magnitude });
    }

    raw.iter()
        .map(|(id, col)| (id.clone(), remap.get(col).copied().unwrap_or(0)))
        .collect()
}

fn ancestors(start: &str, by_id: &HashMap<String, RawCommit>) -> HashSet<String> {
    let mut out = HashSet::new();
    let mut stack = vec![start.to_string()];
    while let Some(id) = stack.pop() {
        if !out.insert(id.clone()) {
            continue;
        }
        if let Some(commit) = by_id.get(&id) {
            for parent in &commit.parents {
                if by_id.contains_key(parent) {
                    stack.push(parent.clone());
                }
            }
        }
    }
    out
}

fn threat_for(exclusive: u32, commits_apart: u32) -> ThreatLevel {
    if exclusive >= 16 || commits_apart >= 24 {
        ThreatLevel::Severe
    } else if exclusive >= 4 || commits_apart >= 8 {
        ThreatLevel::Moderate
    } else {
        ThreatLevel::Low
    }
}

fn build_dossiers(
    refs: &[RawRef],
    by_id: &HashMap<String, RawCommit>,
    row_of: &HashMap<String, u32>,
    sacred_branch: Option<&str>,
    head: Option<&str>,
) -> Vec<VariantDossier> {
    let sacred_tip = sacred_branch.and_then(|name| {
        refs.iter()
            .find(|r| r.kind == RefKind::Branch && r.name == name)
            .map(|r| r.target.clone())
    });
    let sacred_anc = sacred_tip
        .as_ref()
        .map(|tip| ancestors(tip, by_id))
        .unwrap_or_default();

    let mut dossiers = Vec::new();
    for r in refs.iter().filter(|r| r.kind == RefKind::Branch) {
        if !by_id.contains_key(&r.target) {
            continue;
        }
        let is_sacred = sacred_branch == Some(r.name.as_str());
        let variant_anc = ancestors(&r.target, by_id);
        let exclusive = variant_anc.difference(&sacred_anc).count() as u32;
        let sacred_only = sacred_anc.difference(&variant_anc).count() as u32;
        let commits_apart = if is_sacred {
            0
        } else {
            exclusive + sacred_only
        };
        let diverge_row = variant_anc
            .intersection(&sacred_anc)
            .filter_map(|id| row_of.get(id).copied())
            .max();

        dossiers.push(VariantDossier {
            name: r.name.clone(),
            tip: r.target.clone(),
            is_sacred,
            is_head: head == Some(r.target.as_str()),
            exclusive_commits: if is_sacred { 0 } else { exclusive },
            diverge_row,
            commits_apart,
            threat: if is_sacred {
                ThreatLevel::Low
            } else {
                threat_for(exclusive, commits_apart)
            },
            is_upstream: false,
        });
    }
    let local_names: HashSet<String> = refs
        .iter()
        .filter(|r| r.kind == RefKind::Branch)
        .map(|r| r.name.clone())
        .collect();
    for r in refs.iter().filter(|r| r.kind == RefKind::Remote) {
        if !by_id.contains_key(&r.target) {
            continue;
        }
        let short = r.name.rsplit('/').next().unwrap_or(r.name.as_str());
        if local_names.contains(short) {
            continue;
        }
        let variant_anc = ancestors(&r.target, by_id);
        let exclusive = variant_anc.difference(&sacred_anc).count() as u32;
        let sacred_only = sacred_anc.difference(&variant_anc).count() as u32;
        let commits_apart = exclusive + sacred_only;
        let diverge_row = variant_anc
            .intersection(&sacred_anc)
            .filter_map(|id| row_of.get(id).copied())
            .max();
        dossiers.push(VariantDossier {
            name: r.name.clone(),
            tip: r.target.clone(),
            is_sacred: false,
            is_head: false,
            exclusive_commits: exclusive,
            diverge_row,
            commits_apart,
            threat: threat_for(exclusive, commits_apart),
            is_upstream: true,
        });
    }
    dossiers.sort_by(|a, b| {
        b.is_sacred
            .cmp(&a.is_sacred)
            .then(a.is_upstream.cmp(&b.is_upstream))
            .then(a.name.cmp(&b.name))
    });
    dossiers
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub fn c(id: &str, parents: &[&str], ts: i64, summary: &str) -> RawCommit {
        RawCommit {
            id: id.into(),
            parents: parents.iter().map(|p| (*p).to_string()).collect(),
            timestamp: ts,
            summary: summary.into(),
            author: "Analyst".into(),
            email: "analyst@tva.local".into(),
        }
    }

    pub fn branch(name: &str, target: &str) -> RawRef {
        RawRef {
            name: name.into(),
            target: target.into(),
            kind: RefKind::Branch,
        }
    }

    pub fn remote_ref(name: &str, target: &str) -> RawRef {
        RawRef {
            name: name.into(),
            target: target.into(),
            kind: RefKind::Remote,
        }
    }

    pub fn tag(name: &str, target: &str) -> RawRef {
        RawRef {
            name: name.into(),
            target: target.into(),
            kind: RefKind::Tag,
        }
    }

    pub fn node<'a>(tl: &'a Timeline, id: &str) -> &'a TimelineNode {
        tl.nodes
            .iter()
            .find(|n| n.id == id)
            .unwrap_or_else(|| panic!("missing node {id}"))
    }

    pub fn assert_invariants(tl: &Timeline) {
        let mut positions: HashSet<(i32, u32)> = HashSet::new();
        let mut by_id: HashMap<&str, &TimelineNode> = HashMap::new();
        for n in &tl.nodes {
            assert!(
                positions.insert((n.column, n.row)),
                "overlapping nexus at column {} row {} ({})",
                n.column,
                n.row,
                n.id
            );
            by_id.insert(&n.id, n);
        }

        for edge in &tl.edges {
            let from = by_id
                .get(edge.from.as_str())
                .unwrap_or_else(|| panic!("edge from missing {}", edge.from));
            let to = by_id
                .get(edge.to.as_str())
                .unwrap_or_else(|| panic!("edge to missing {}", edge.to));
            assert_eq!(from.column, edge.from_column);
            assert_eq!(to.column, edge.to_column);
            assert_eq!(from.row, edge.from_row);
            assert_eq!(to.row, edge.to_row);
            assert!(
                from.row < to.row,
                "time must flow parent {} (row {}) -> child {} (row {})",
                from.id,
                from.row,
                to.id,
                to.row
            );
        }

        if let Some(sacred) = &tl.sacred_branch {
            let dossier = tl
                .dossiers
                .iter()
                .find(|d| d.name == *sacred)
                .unwrap_or_else(|| panic!("sacred dossier {sacred}"));
            assert!(dossier.is_sacred);
            assert_eq!(dossier.exclusive_commits, 0);
            assert_eq!(dossier.threat, ThreatLevel::Low);
        }
    }

    fn columns_of(tl: &Timeline, ids: &[&str]) -> HashSet<i32> {
        ids.iter().map(|id| node(tl, id).column).collect()
    }

    #[test]
    fn linear_trunk_stays_on_sacred_lane() {
        let tl = layout_timeline(
            vec![
                c("a", &[], 1, "root"),
                c("b", &["a"], 2, "second"),
                c("c", &["b"], 3, "third"),
                c("d", &["c"], 4, "tip"),
            ],
            vec![branch("main", "d")],
            Some("d".into()),
            Some("main".into()),
        );
        assert_invariants(&tl);
        assert_eq!(tl.sacred_branch.as_deref(), Some("main"));
        assert!(tl.nodes.iter().all(|n| n.column == 0));
        assert_eq!(tl.nodes.len(), 4);
        assert_eq!(node(&tl, "d").is_head, true);
        assert!(node(&tl, "d").refs.iter().any(|r| r.name == "main"));
    }

    #[test]
    fn two_short_variants_split_above_and_below() {
        let tl = layout_timeline(
            vec![
                c("a", &[], 1, "root"),
                c("b", &["a"], 2, "nexus"),
                c("c", &["b"], 3, "sacred"),
                c("d", &["c"], 4, "sacred tip"),
                c("e", &["b"], 5, "variant left"),
                c("f", &["c"], 6, "variant right"),
            ],
            vec![
                branch("main", "d"),
                branch("feature", "e"),
                branch("hotfix", "f"),
            ],
            Some("d".into()),
            Some("main".into()),
        );
        assert_invariants(&tl);
        assert_eq!(node(&tl, "a").column, 0);
        assert_eq!(node(&tl, "b").column, 0);
        assert_eq!(node(&tl, "c").column, 0);
        assert_eq!(node(&tl, "d").column, 0);
        let variant_cols = columns_of(&tl, &["e", "f"]);
        assert_eq!(variant_cols.len(), 2);
        assert!(!variant_cols.contains(&0));
        assert!(variant_cols.iter().any(|col| *col > 0));
        assert!(variant_cols.iter().any(|col| *col < 0));
    }

    #[test]
    fn many_branches_from_one_nexus_get_unique_lanes() {
        let mut commits = vec![c("nexus", &[], 1, "nexus")];
        let mut refs = vec![branch("main", "nexus")];
        for i in 1..=8 {
            let id = format!("v{i}");
            commits.push(c(&id, &["nexus"], 10 + i, &format!("variant {i}")));
            refs.push(branch(&format!("var-{i}"), &id));
        }
        // Give main its own forward commit so sacred is distinct.
        commits.push(c("sacred", &["nexus"], 2, "sacred tip"));
        refs[0].target = "sacred".into();

        let tl = layout_timeline(commits, refs, Some("sacred".into()), Some("main".into()));
        assert_invariants(&tl);
        assert_eq!(tl.dossiers.len(), 9);

        let mut tip_cols = HashSet::new();
        tip_cols.insert(node(&tl, "sacred").column);
        for i in 1..=8 {
            let col = node(&tl, &format!("v{i}")).column;
            assert_ne!(col, 0, "variant {i} should leave the sacred lane");
            assert!(tip_cols.insert(col), "variant {i} reused column {col}");
        }
        assert_eq!(node(&tl, "nexus").column, 0);
    }

    #[test]
    fn long_diverged_branches_keep_a_stable_lane() {
        let mut commits = vec![c("root", &[], 1, "root")];
        let mut prev_s = "root".to_string();
        let mut sacred_ids = vec!["root".to_string()];
        for i in 1..=24 {
            let id = format!("s{i}");
            commits.push(c(&id, &[&prev_s], 100 + i, &format!("sacred {i}")));
            sacred_ids.push(id.clone());
            prev_s = id;
        }

        let mut prev_v = "root".to_string();
        let mut variant_ids = Vec::new();
        for i in 1..=24 {
            let id = format!("v{i}");
            commits.push(c(&id, &[&prev_v], 200 + i, &format!("variant {i}")));
            variant_ids.push(id.clone());
            prev_v = id;
        }

        let tl = layout_timeline(
            commits,
            vec![branch("main", &prev_s), branch("long-feature", &prev_v)],
            Some(prev_s.clone()),
            Some("main".into()),
        );
        assert_invariants(&tl);

        for id in &sacred_ids {
            assert_eq!(node(&tl, id).column, 0, "{id} left the sacred lane");
        }
        let variant_cols = columns_of(
            &tl,
            &variant_ids.iter().map(String::as_str).collect::<Vec<_>>(),
        );
        assert_eq!(
            variant_cols.len(),
            1,
            "long-diverged exclusive history hopped lanes: {variant_cols:?}"
        );
        assert!(!variant_cols.contains(&0));

        let dossier = tl
            .dossiers
            .iter()
            .find(|d| d.name == "long-feature")
            .unwrap();
        assert_eq!(dossier.exclusive_commits, 24);
        assert_eq!(dossier.commits_apart, 48);
        assert_eq!(dossier.threat, ThreatLevel::Severe);
        assert_eq!(dossier.diverge_row, Some(node(&tl, "root").row));
    }

    #[test]
    fn merge_commit_records_merge_edge() {
        let tl = layout_timeline(
            vec![
                c("a", &[], 1, "root"),
                c("b", &["a"], 2, "sacred"),
                c("c", &["b"], 3, "sacred 2"),
                c("d", &["a"], 4, "variant"),
                c("e", &["d"], 5, "variant 2"),
                c("m", &["c", "e"], 6, "merge"),
            ],
            vec![branch("main", "m"), branch("feature", "e")],
            Some("m".into()),
            Some("main".into()),
        );
        assert_invariants(&tl);
        let merges: Vec<_> = tl
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Merge)
            .collect();
        assert_eq!(merges.len(), 1);
        assert_eq!(merges[0].from, "e");
        assert_eq!(merges[0].to, "m");
        assert_eq!(node(&tl, "m").column, 0);
        assert_ne!(node(&tl, "e").column, 0);
    }

    #[test]
    fn prefers_main_as_sacred_over_current_feature() {
        let tl = layout_timeline(
            vec![c("a", &[], 1, "root"), c("b", &["a"], 2, "feature tip")],
            vec![branch("main", "a"), branch("feature", "b")],
            Some("b".into()),
            None,
        );
        assert_eq!(tl.sacred_branch.as_deref(), Some("main"));
        assert_eq!(node(&tl, "a").column, 0);
        assert_ne!(node(&tl, "b").column, 0);
    }

    #[test]
    fn clock_skew_still_orders_parents_before_children() {
        let tl = layout_timeline(
            vec![
                c("child", &["parent"], 1, "newer clock on parent"),
                c("parent", &[], 50, "older clock"),
            ],
            vec![branch("main", "child")],
            Some("child".into()),
            Some("main".into()),
        );
        assert_invariants(&tl);
        assert!(node(&tl, "parent").row < node(&tl, "child").row);
    }

    #[test]
    fn remote_only_tip_gets_upstream_dossier() {
        let tl = layout_timeline(
            vec![
                c("a", &[], 1, "root"),
                c("b", &["a"], 2, "sacred"),
                c("c", &["a"], 3, "upstream only"),
            ],
            vec![branch("main", "b"), remote_ref("origin/feature", "c")],
            Some("b".into()),
            Some("main".into()),
        );
        assert_invariants(&tl);
        let up = tl
            .dossiers
            .iter()
            .find(|d| d.name == "origin/feature")
            .expect("upstream dossier");
        assert!(up.is_upstream);
        assert_ne!(node(&tl, "c").column, 0);
        assert!(node(&tl, "c")
            .refs
            .iter()
            .any(|r| r.kind == RefKind::Remote));
    }

    #[test]
    fn remote_tracking_of_local_branch_does_not_duplicate_dossier() {
        let tl = layout_timeline(
            vec![c("a", &[], 1, "root"), c("b", &["a"], 2, "tip")],
            vec![branch("main", "b"), remote_ref("origin/main", "b")],
            Some("b".into()),
            Some("main".into()),
        );
        assert_invariants(&tl);
        assert_eq!(
            tl.dossiers
                .iter()
                .filter(|d| d.name.contains("main"))
                .count(),
            1
        );
        assert!(!tl.dossiers.iter().any(|d| d.is_upstream));
        assert!(node(&tl, "b")
            .refs
            .iter()
            .any(|r| r.kind == RefKind::Remote));
    }

    #[test]
    fn historic_tags_stay_on_the_sacred_lane() {
        let tl = layout_timeline(
            vec![
                c("a", &[], 1, "root"),
                c("b", &["a"], 2, "v1"),
                c("c", &["b"], 3, "v2"),
                c("d", &["c"], 4, "tip"),
            ],
            vec![branch("main", "d"), tag("v1.0", "b"), tag("v2.0", "c")],
            Some("d".into()),
            Some("main".into()),
        );
        assert_invariants(&tl);
        assert!(
            tl.nodes.iter().all(|n| n.column == 0),
            "tags must not open variant lanes"
        );
        assert!(node(&tl, "b")
            .refs
            .iter()
            .any(|r| r.kind == RefKind::Tag && r.name == "v1.0"));
        assert!(node(&tl, "c")
            .refs
            .iter()
            .any(|r| r.kind == RefKind::Tag && r.name == "v2.0"));
        assert_eq!(tl.dossiers.len(), 1);
    }

    #[test]
    fn tag_on_a_variant_does_not_add_a_lane() {
        let tl = layout_timeline(
            vec![
                c("a", &[], 1, "root"),
                c("b", &["a"], 2, "sacred"),
                c("c", &["a"], 3, "feature"),
            ],
            vec![
                branch("main", "b"),
                branch("feature", "c"),
                tag("v-feat", "c"),
            ],
            Some("b".into()),
            Some("main".into()),
        );
        assert_invariants(&tl);
        assert_eq!(node(&tl, "b").column, 0);
        assert_ne!(node(&tl, "c").column, 0);
        let cols: HashSet<i32> = tl.nodes.iter().map(|n| n.column).collect();
        assert_eq!(
            cols.len(),
            2,
            "tag must share the variant lane, not open a third"
        );
    }
}
