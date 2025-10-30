import queue
import threading
from concurrent.futures import ThreadPoolExecutor

# 큐 및 동시 작업 제한 설정
MAX_CONCURRENT_TASKS = 100
TASK_QUEUE = queue.Queue()
EXECUTOR = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_TASKS)

# 락 및 제어 변수
running_tasks = 0
lock = threading.Lock()

def worker_loop():
    global running_tasks
    while True:
        func, args, kwargs = TASK_QUEUE.get()  # 블로킹 큐
        with lock:
            running_tasks += 1

        try:
            func(*args, **kwargs)
        except Exception as e:
            print(f"[AI 작업 오류] {e}")
        finally:
            with lock:
                running_tasks -= 1
            TASK_QUEUE.task_done()

# 백그라운드 워커 스레드 실행
threading.Thread(target=worker_loop, daemon=True).start()

def enqueue_task(func, *args, **kwargs):
    TASK_QUEUE.put((func, args, kwargs))
    print(f"[AI 큐] 현재 대기 중: {TASK_QUEUE.qsize()}건, 실행 중: {running_tasks}")
