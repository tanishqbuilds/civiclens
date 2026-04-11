FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for image processing
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Run with gunicorn for production
CMD ["gunicorn", "--workers", "1", "--timeout", "300", "--bind", "0.0.0.0:5000", "app:app"]
