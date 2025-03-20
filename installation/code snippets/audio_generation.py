import replicate
import os
from datetime import datetime
import requests
import random
import time
import base64

generation_path = "generation"
folders = [f for f in os.listdir(generation_path) if os.path.isdir(os.path.join(generation_path, f))]
newest_folder = max(folders, key=lambda x: int(x))

file_path = os.path.join(generation_path, newest_folder)

# Redirect print statements to the log file
def log_print(*args, **kwargs):
    with open(os.path.join(file_path, "log.txt"), 'a') as log_file:
        print(*args, file=log_file, **kwargs)

with open(os.path.join(file_path, "description.txt"), 'rb') as file:
    prompt = file.read().decode('utf-8')

speakers = ["matteoExample.wav", "matteoExample.wav", "matteoExample.wav", "matteoExample.wav"]

with open(os.path.join("installation/example_imgs", speakers[random.randint(0, 3)]), 'rb') as file:
  data = base64.b64encode(file.read()).decode('utf-8')
  speaker = f"data:application/octet-stream;base64,{data}"

input = {
    "text": prompt,
    "language": "en",
    "speaker": speaker,
    "cleanup_voice": False
}

prediction = replicate.predictions.create(
  version="684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e",
  input=input
)

start_time = time.time()
previous_status = ""
while prediction.status not in {"succeeded", "failed", "canceled"}:
    if previous_status != prediction.status:
        previous_status = prediction.status
        start_time = time.time()

    log_print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction.status}")
    prediction.reload()

    if time.time() - start_time > 120:
        log_print("Process interrupted for timeout.")
        exit()
    
if prediction.status == "succeeded":
    log_print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction}")

    response = requests.get(prediction.output)
    with open(os.path.join(file_path, f"generatedAudio.wav"), "wb") as file:
            file.write(response.content)

else:
    log_print("Error generating image description. The status is: " + prediction.status +". \nGeneral prediction output: " + str(prediction))
    exit()