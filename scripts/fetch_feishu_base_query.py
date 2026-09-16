#!/usr/bin/env python3
"""Fetch a Feishu Base query-share via official Open Platform APIs.

Saves raw API JSON into a date directory (YYYY_MM_DD). Prints only HTTP
status, error codes, byte sizes, and record counts — never record bodies.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

SHARE_URL = os.environ.get(
    "FEISHU_SHARE_URL",
    "https://lcnacj6svcnr.feishu.cn/share/base/query/shrcnrDf1C1ytsCL7EHBV1ixUnq",
)
SHARE_TOKEN = os.environ.get("FEISHU_SHARE_TOKEN", "shrcnrDf1C1ytsCL7EHBV1ixUnq")
OPEN_API = "https://open.feishu.cn/open-apis"
PAGE_SIZE = 500


def log(message: str) -> None:
    sys.stderr.write(message + "\n")
    sys.stderr.flush()


def env_first(*names: str) -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return ""


def request_json(
    method: str,
    url: str,
    token: str | None = None,
    body: dict[str, Any] | None = None,
) -> tuple[int, dict[str, Any], int]:
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            status = resp.status
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        status = exc.code
    try:
        payload = json.loads(raw.decode("utf-8") if raw else "{}")
    except json.JSONDecodeError:
        payload = {"code": -1, "msg": "non-json response", "raw_bytes": len(raw)}
    if not isinstance(payload, dict):
        payload = {"code": -1, "msg": "unexpected payload type", "data": payload}
    return status, payload, len(raw)


def save_json(path: Path, payload: Any) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    path.write_bytes(encoded)
    return len(encoded)


def require_app_credentials() -> tuple[str, str]:
    app_id = env_first("FEISHU_APP_ID", "LARK_APP_ID")
    app_secret = env_first("FEISHU_APP_SECRET", "LARK_APP_SECRET")
    if not app_id or not app_secret:
        log(
            "missing FEISHU_APP_ID/FEISHU_APP_SECRET (or LARK_APP_ID/LARK_APP_SECRET); "
            "official Open APIs require tenant_access_token"
        )
        raise SystemExit(2)
    return app_id, app_secret


def tenant_access_token(app_id: str, app_secret: str) -> str:
    preset = env_first("FEISHU_TENANT_ACCESS_TOKEN", "LARK_TENANT_ACCESS_TOKEN")
    if preset:
        log("using tenant_access_token from environment")
        return preset
    status, payload, nbytes = request_json(
        "POST",
        f"{OPEN_API}/auth/v3/tenant_access_token/internal",
        body={"app_id": app_id, "app_secret": app_secret},
    )
    code = payload.get("code")
    token = payload.get("tenant_access_token")
    log(f"auth/v3/tenant_access_token/internal status={status} code={code} bytes={nbytes}")
    if code != 0 or not isinstance(token, str) or not token:
        log(f"failed to obtain tenant_access_token msg={payload.get('msg')}")
        raise SystemExit(3)
    return token


def call(
    out_dir: Path,
    name: str,
    method: str,
    url: str,
    token: str,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    status, payload, nbytes = request_json(method, url, token=token, body=body)
    written = save_json(out_dir / f"{name}.json", payload)
    log(
        f"{name} status={status} code={payload.get('code')} "
        f"msg={payload.get('msg')} http_bytes={nbytes} saved_bytes={written}"
    )
    return payload


def paginate_search(out_dir: Path, token: str, app_token: str, table_id: str) -> int:
    table_dir = out_dir / "tables" / table_id
    page_token = ""
    page_index = 0
    total = 0
    while True:
        query = urlencode({"page_size": PAGE_SIZE, **({"page_token": page_token} if page_token else {})})
        url = (
            f"{OPEN_API}/bitable/v1/apps/{app_token}/tables/{table_id}"
            f"/records/search?{query}"
        )
        payload = call(
            table_dir,
            f"records_search_{page_index:04d}",
            "POST",
            url,
            token,
            body={},
        )
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        items = data.get("items") if isinstance(data, dict) else None
        count = len(items) if isinstance(items, list) else 0
        total += count
        log(f"table={table_id} page={page_index} records={count} total={total}")
        if not (isinstance(data, dict) and data.get("has_more") and data.get("page_token")):
            break
        page_token = str(data.get("page_token"))
        page_index += 1
    return total


def resolve_app_token(out_dir: Path, token: str) -> str | None:
    candidates: list[str] = []

    wiki = call(
        out_dir / "resolve",
        "wiki_get_node",
        "GET",
        f"{OPEN_API}/wiki/v2/spaces/get_node?token={SHARE_TOKEN}",
        token,
    )
    node = wiki.get("data", {}).get("node") if isinstance(wiki.get("data"), dict) else None
    if isinstance(node, dict):
        obj_token = node.get("obj_token")
        if isinstance(obj_token, str) and obj_token:
            candidates.append(obj_token)

    share_meta = call(
        out_dir / "resolve",
        "record_share_meta",
        "GET",
        f"{OPEN_API}/base/v3/record_share/{SHARE_TOKEN}/meta",
        token,
    )
    share_data = share_meta.get("data") if isinstance(share_meta.get("data"), dict) else {}
    if isinstance(share_data, dict):
        for key in ("base_token", "app_token"):
            value = share_data.get(key)
            if isinstance(value, str) and value:
                candidates.append(value)

    call(
        out_dir / "resolve",
        "drive_metas",
        "POST",
        f"{OPEN_API}/drive/v1/metas/batch_query",
        token,
        body={"request_docs": [{"doc_token": SHARE_TOKEN, "doc_type": "bitable"}]},
    )

    candidates.append(SHARE_TOKEN)
    seen: set[str] = set()
    unique = []
    for item in candidates:
        if item not in seen:
            seen.add(item)
            unique.append(item)

    for app_token in unique:
        payload = call(
            out_dir / "resolve",
            f"bitable_app_{app_token[:12]}",
            "GET",
            f"{OPEN_API}/bitable/v1/apps/{app_token}",
            token,
        )
        if payload.get("code") == 0:
            resolved = (
                payload.get("data", {}).get("app", {}).get("app_token")
                if isinstance(payload.get("data"), dict)
                else None
            )
            return resolved if isinstance(resolved, str) and resolved else app_token
    return None


def fetch_tables(out_dir: Path, token: str, app_token: str) -> list[str]:
    table_ids: list[str] = []
    page_token = ""
    page_index = 0
    while True:
        query = urlencode({"page_size": 100, **({"page_token": page_token} if page_token else {})})
        payload = call(
            out_dir,
            f"tables_{page_index:04d}",
            "GET",
            f"{OPEN_API}/bitable/v1/apps/{app_token}/tables?{query}",
            token,
        )
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        items = data.get("items") if isinstance(data, dict) else None
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and isinstance(item.get("table_id"), str):
                    table_ids.append(item["table_id"])
        if not (isinstance(data, dict) and data.get("has_more") and data.get("page_token")):
            break
        page_token = str(data.get("page_token"))
        page_index += 1
    return table_ids


def main() -> int:
    app_id, app_secret = require_app_credentials()
    access_token = tenant_access_token(app_id, app_secret)

    date_dir = os.environ.get("FEISHU_DATE_DIR") or datetime.now(timezone.utc).strftime("%Y_%m_%d")
    repo_root = Path(__file__).resolve().parents[1]
    out_dir = repo_root / date_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    save_json(
        out_dir / "_source.json",
        {
            "share_url": SHARE_URL,
            "share_token": SHARE_TOKEN,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "open_api_base": OPEN_API,
        },
    )

    app_token = resolve_app_token(out_dir, access_token)
    if not app_token:
        log("could not resolve bitable app_token from official APIs")
        save_json(out_dir / "_fetch_status.json", {"ok": False, "reason": "app_token_unresolved"})
        return 4

    save_json(out_dir / "_resolved.json", {"app_token": app_token})
    table_ids = fetch_tables(out_dir, access_token, app_token)
    log(f"tables={len(table_ids)}")

    totals: dict[str, int] = {}
    for table_id in table_ids:
        call(
            out_dir / "tables" / table_id,
            "fields",
            "GET",
            f"{OPEN_API}/bitable/v1/apps/{app_token}/tables/{table_id}/fields?page_size=100",
            access_token,
        )
        totals[table_id] = paginate_search(out_dir, access_token, app_token, table_id)

    save_json(
        out_dir / "_fetch_status.json",
        {
            "ok": True,
            "app_token": app_token,
            "table_count": len(table_ids),
            "record_counts": totals,
        },
    )
    log(f"saved under {out_dir} tables={len(table_ids)} records={sum(totals.values())}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        log(f"unhandled error: {type(exc).__name__}")
        raise SystemExit(1)
