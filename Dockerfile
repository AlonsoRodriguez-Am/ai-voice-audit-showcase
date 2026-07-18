# Use an NVIDIA CUDA base image with Python
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu22.04

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install Python and other dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    ffmpeg \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Verify CUDA is accessible by PyTorch
RUN python3 -c "import torch; print(f'PyTorch CUDA available: {torch.cuda.is_available()}')"

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application (warm up models then start server)
CMD ["sh", "-c", "python3 -c 'from app.core.init_models import initialize_whisper; initialize_whisper()' && uvicorn app.main:app --host 0.0.0.0 --port 5000"]
