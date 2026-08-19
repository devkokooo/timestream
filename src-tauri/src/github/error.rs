use crate::error::AppError;
use reqwest::StatusCode;
use serde_json::Value;

pub fn hint(text: &str) -> String {
    if let Ok(body) = serde_json::from_str::<Value>(text) {
        if let Some(msg) = body
            .get("message")
            .and_then(|m| m.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            return msg.to_string();
        }
    }
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "no message from origin".to_string();
    }
    if trimmed.len() > 200 {
        format!("{}…", trimmed.chars().take(200).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

fn is_rate_limit(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.contains("rate limit")
        || lower.contains("secondary rate")
        || lower.contains("abuse detection")
}

pub fn api_error(status: StatusCode, text: String) -> AppError {
    let detail = hint(&text);
    match status.as_u16() {
        401 => AppError::msg("GITHUB_AUTH_REQUIRED"),
        403 if is_rate_limit(&text) || is_rate_limit(&detail) => {
            AppError::msg(format!("GITHUB_RATE_LIMIT: {detail}"))
        }
        429 => AppError::msg(format!("GITHUB_RATE_LIMIT: {detail}")),
        403 => AppError::msg(format!("GITHUB_FORBIDDEN: {detail}")),
        404 => AppError::msg(format!("GITHUB_NOT_FOUND: {detail}")),
        500 | 502 | 503 | 504 => AppError::msg(format!("GITHUB_OUTAGE: {detail}")),
        _ => AppError::msg(format!("GITHUB_DISPATCH: GitHub API {status}: {detail}")),
    }
}

pub fn transport_error(err: reqwest::Error) -> AppError {
    if err.is_timeout() || err.is_connect() || err.is_request() {
        AppError::msg(format!("GITHUB_OUTAGE: {err}"))
    } else {
        err.into()
    }
}

pub fn graphql_error(msg: &str) -> AppError {
    let lower = msg.to_ascii_lowercase();
    if lower.contains("rate limit") {
        AppError::msg(format!("GITHUB_RATE_LIMIT: {msg}"))
    } else if lower.contains("not accessible") || lower.contains("forbidden") {
        AppError::msg(format!("GITHUB_FORBIDDEN: {msg}"))
    } else if lower.contains("not found") || lower.contains("could not resolve") {
        AppError::msg(format!("GITHUB_NOT_FOUND: {msg}"))
    } else {
        AppError::msg(format!("GITHUB_DISPATCH: {msg}"))
    }
}

pub fn is_auth_required(err: &AppError) -> bool {
    err.to_string().contains("GITHUB_AUTH_REQUIRED")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(status: u16, body: &str) -> String {
        api_error(StatusCode::from_u16(status).unwrap(), body.to_string()).to_string()
    }

    #[test]
    fn classifies_status_and_strips_json() {
        let cases = [
            (
                401,
                r#"{"message":"Bad credentials"}"#,
                "GITHUB_AUTH_REQUIRED",
            ),
            (
                403,
                r#"{"message":"API rate limit exceeded for user"}"#,
                "GITHUB_RATE_LIMIT: API rate limit exceeded for user",
            ),
            (
                429,
                r#"{"message":"You have exceeded a secondary rate limit"}"#,
                "GITHUB_RATE_LIMIT: You have exceeded a secondary rate limit",
            ),
            (
                403,
                r#"{"message":"Resource not accessible by integration"}"#,
                "GITHUB_FORBIDDEN: Resource not accessible by integration",
            ),
            (
                404,
                r#"{"message":"Not Found"}"#,
                "GITHUB_NOT_FOUND: Not Found",
            ),
            (
                503,
                r#"{"message":"Service Unavailable"}"#,
                "GITHUB_OUTAGE: Service Unavailable",
            ),
            (
                500,
                "upstream exploded",
                "GITHUB_OUTAGE: upstream exploded",
            ),
            (
                422,
                r#"{"message":"Validation Failed","errors":[{"code":"invalid"}]}"#,
                "GITHUB_DISPATCH: GitHub API 422 Unprocessable Entity: Validation Failed",
            ),
        ];
        for (status, body, expected) in cases {
            assert_eq!(msg(status, body), expected, "status {status}");
        }
    }

    #[test]
    fn graphql_permission_is_forbidden() {
        assert_eq!(
            graphql_error("Resource not accessible by integration").to_string(),
            "GITHUB_FORBIDDEN: Resource not accessible by integration"
        );
    }

    #[test]
    fn graphql_missing_is_not_found() {
        assert_eq!(
            graphql_error("Could not resolve to a PullRequest").to_string(),
            "GITHUB_NOT_FOUND: Could not resolve to a PullRequest"
        );
    }

    #[test]
    fn empty_body_has_fallback_hint() {
        assert_eq!(
            msg(503, "  "),
            "GITHUB_OUTAGE: no message from origin"
        );
    }
}
