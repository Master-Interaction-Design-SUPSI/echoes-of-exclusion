import replicate
import os
from datetime import datetime
import requests

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

input = {
    "prompt": prompt,
    "go_fast": True,
    "guidance": 3.5,
    "num_outputs": 1,
    "aspect_ratio": "1:1",
    "output_format": "png",
    "output_quality": 100,
    "prompt_strength": 0.8,
    "num_inference_steps": 28
}

prediction = replicate.predictions.create(
    model="black-forest-labs/flux-dev",
    input= input
)

while prediction.status not in {"succeeded", "failed", "canceled"}:
    log_print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction.status}")
    prediction.reload()

if prediction.status == "succeeded":
    log_print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction}")
    
    for index, item in enumerate(prediction.output):
        response = requests.get(item)
        with open(os.path.join(file_path, f"generatedImage_{index}.png"), "wb") as file:
            file.write(response.content)

else:
    log_print("Error generating image description. The status is: " + prediction.status +". \nGeneral prediction output: " + str(prediction))
    exit()