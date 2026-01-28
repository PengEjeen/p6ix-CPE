#!/usr/bin/env python3
import argparse
import subprocess
import sys

# 기본 URL만 사용.
RTSP_URL = "rtsp://fh3b2dc3:@caps010@221.153.163.102:601/h265"


def build_url(args: argparse.Namespace) -> str:
    return args.url or RTSP_URL


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simple RTSP handshake test.")
    parser.add_argument(
        "--transport",
        choices=["tcp", "udp"],
        help="RTSP transport (ffprobe/ffmpeg).",
    )
    parser.add_argument("--timeout-ms", type=int, help="Socket timeout in ms.")
    parser.add_argument("--url", help="Override the default RTSP URL.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    url = build_url(args)

    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "default=nw=1",
    ]
    if args.transport:
        cmd.extend(["-rtsp_transport", args.transport])
    if args.timeout_ms:
        cmd.extend(["-stimeout", str(args.timeout_ms * 1000)])
    cmd.extend(["-i", url])

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        print("ffprobe not found. Please install ffmpeg/ffprobe.")
        return 2

    if proc.returncode != 0:
        err = proc.stderr.strip() or "ffprobe failed."
        print(f"RTSP handshake failed: {err}")
        return 1

    output = proc.stdout.strip()
    if output:
        print("RTSP handshake OK.")
        print(output)
    else:
        print("RTSP handshake OK (no stream info).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
