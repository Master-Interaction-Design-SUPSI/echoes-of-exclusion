import replicate
import base64
import os
from datetime import datetime

# Create a directory with the current timestamp
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_dir = f"generation/{timestamp}"
os.makedirs(log_dir, exist_ok=True)

log_file_path = os.path.join(log_dir, "log.txt")
description_file_path = os.path.join(log_dir, "description.txt")  # New file for description

# Redirect print statements to the log file
def log_print(*args, **kwargs):
    with open(log_file_path, 'a') as log_file:
        print(*args, file=log_file, **kwargs)

with open("installation/example_imgs/imageExample01.jpg", 'rb') as file:
  data = base64.b64encode(file.read()).decode('utf-8')
  image = f"data:application/octet-stream;base64,{data}"

input = {
    "image": image,
    "top_p": 1,
    "prompt": "Describe the image by creating a prompt to generate a similar image",
    "max_tokens": 1024,
    "temperature": 0.7
}

prediction = replicate.predictions.create(
  version="19be067b589d0c46689ffa7cc3ff321447a441986a7694c01225973c2eafc874",
  input=input
)

while prediction.status not in {"succeeded", "failed", "canceled"}:
    log_print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction.status}")
    prediction.reload()

if prediction.status == "succeeded":
    log_print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction}")
    description = ""

    for i in prediction.output:
        description += i
        
    # Write the description to a separate file
    with open(description_file_path, 'w') as desc_file:
        desc_file.write(description)

else:
    log_print("Error generating image description. The status is: " + prediction.status +". \nGeneral prediction output: " + str(prediction))
    exit()