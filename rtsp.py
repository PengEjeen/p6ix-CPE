#!/usr/bin/env python3
import argparse
import os
import sys
import time

try:
    import cv2  
except ImportError as exc:
    raise SystemExit("opencv-python is required for this script.") from exc


# 기본 URL만 사용.
RTSP_URL = "rtsp://admin1:11qqaa..@192.168.1.100:554/h265"


def build_url(args: argparse.Namespace) -> str:
    return RTSP_URL


def apply_ffmpeg_options(transport: str | None, timeout_ms: int | None) -> None:
    if not transport and not timeout_ms:
        return
    options = []
    if transport:
        options.append(f"rtsp_transport;{transport}")
    if timeout_ms:
        options.append(f"stimeout;{timeout_ms * 1000}")
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "|".join(options)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simple RTSP test client.")
    parser.add_argument(
        "--transport",
        choices=["tcp", "udp"],
        help="RTSP transport (ffmpeg).",
    )
    parser.add_argument("--timeout-ms", type=int, help="Socket timeout in ms.")
    parser.add_argument("--frames", type=int, default=0, help="Stop after N frames.")
    parser.add_argument("--show", action="store_true", help="Display the stream.")
    parser.add_argument("--save", help="Save a single frame to this path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    apply_ffmpeg_options(args.transport, args.timeout_ms)
    url = build_url(args)

    cap = cv2.VideoCapture(url)
    if not cap.isOpened():
        print(f"Failed to open RTSP stream: {url}")
        return 1

    frame_count = 0
    t0 = time.perf_counter()
    saved = False

    while True:
        ok, frame = cap.read()
        if not ok:
            print("Frame read failed.")
            break

        frame_count += 1
        if args.save and not saved:
            cv2.imwrite(args.save, frame)
            print(f"Saved frame to {args.save}")
            saved = True

        if args.show:
            cv2.imshow("RTSP", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        if frame_count % 30 == 0:
            dt = time.perf_counter() - t0
            fps = frame_count / dt if dt > 0 else 0.0
            print(f"Frames: {frame_count} | FPS: {fps:.2f}")

        if args.frames and frame_count >= args.frames:
            break

    cap.release()
    if args.show:
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
