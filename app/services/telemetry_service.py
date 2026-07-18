import pynvml
import psutil
from typing import Dict, Any

class TelemetryService:
    def __init__(self):
        self.gpu_available = False
        try:
            pynvml.nvmlInit()
            self.gpu_available = True
        except Exception as e:
            print(f"Warning: GPU telemetry not available: {e}")

    def get_gpu_stats(self) -> Dict[str, Any]:
        if not self.gpu_available:
            return {
                "available": False,
                "message": "NVIDIA GPU not detected or driver missing."
            }
        
        try:
            deviceCount = pynvml.nvmlDeviceGetCount()
            stats = []
            
            for i in range(deviceCount):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                name = pynvml.nvmlDeviceGetName(handle)
                utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
                memory = pynvml.nvmlDeviceGetMemoryInfo(handle)
                temperature = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                
                stats.append({
                    "id": i,
                    "name": name,
                    "temperature_c": temperature,
                    "gpu_utilization_percent": utilization.gpu,
                    "memory_utilization_percent": utilization.memory,
                    "memory_used_mb": memory.used // (1024 ** 2),
                    "memory_total_mb": memory.total // (1024 ** 2),
                    "memory_free_mb": memory.free // (1024 ** 2),
                })
            
            # System metrics
            cpu_percent = psutil.cpu_percent()
            ram = psutil.virtual_memory()
            
            return {
                "available": True,
                "system": {
                    "cpu_percent": cpu_percent,
                    "ram_used_mb": ram.used // (1024 ** 2),
                    "ram_total_mb": ram.total // (1024 ** 2),
                    "ram_percent": ram.percent
                },
                "gpus": stats
            }
        except Exception as e:
            return {
                "available": False,
                "message": f"Error reading GPU stats: {str(e)}"
            }

telemetry_service = TelemetryService()
