# Combined Python Script: Image Description -> Image Generation -> Audio Generation

# Consolidated imports
import replicate
import os
from datetime import datetime
import requests
import random
import time
import base64
from dotenv import load_dotenv
import shutil

def log_print(log_file_path, *args, **kwargs):
            with open(log_file_path, 'a') as log_file:
                print(*args, file=log_file, **kwargs)

def run_image_description(image_path, log_dir):
    log_file_path = os.path.join(log_dir, "log.txt")
    
    try:
        shutil.copy(image_path, os.path.join(log_dir, "originalImage" + os.path.splitext(image_path)[1]))
        log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Original image saved as originalImage in log directory.")

        description_file_path = os.path.join(log_dir, "description.txt")  # New file for description
        
        with open(image_path, 'rb') as file:
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
            log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction.status}")
            prediction.reload()
        
        if prediction.status == "succeeded":
            log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction}")
            description = ""
        
            for i in prediction.output:
                description += i
                
            # Write the description to a separate file
            with open(description_file_path, 'w') as desc_file:
                desc_file.write(description)
        
        else:
            log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Error generating image description. The status is: " + prediction.status +". \nGeneral prediction output: " + str(prediction))
            exit()
        log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Image description completed successfully.")
    except Exception as e:
        log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Error in Image Description: {e}")

def run_image_generation(directory):
    log_path = os.path.join(directory, "log.txt")

    try:  
        with open(os.path.join(directory, "description.txt"), 'rb') as file:
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
            log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction.status}")
            prediction.reload()
        
        if prediction.status == "succeeded":
            log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction}")
            
            for index, item in enumerate(prediction.output):
                response = requests.get(item)
                with open(os.path.join(directory, f"generatedImage_{index}.png"), "wb") as file:
                    file.write(response.content)
        
        else:
            log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Error generating image description. The status is: " + prediction.status +". \nGeneral prediction output: " + str(prediction))
            exit()
        log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Image generation completed successfully.")
    except Exception as e:
        log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Error in Image Generation: {e}")

def run_audio_generation(directory):
    log_path = os.path.join(directory, "log.txt")

    try:
        with open(os.path.join(directory, "description.txt"), 'rb') as file:
            prompt = file.read().decode('utf-8')
        
        speakers = ["matteoAudio.wav", "cathrineAudio.wav", "hannaAudio.wav", "aminaAudio.wav"]
        
        with open(os.path.join("installation/audioBase", speakers[random.randint(0, 3)]), 'rb') as file:
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
        
            log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction.status}")
            prediction.reload()
        
            if time.time() - start_time > 120:
                log_print(log_path, "Process interrupted for timeout.")
                exit()
            
        if prediction.status == "succeeded":
            log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {prediction}")
        
            response = requests.get(prediction.output)
            with open(os.path.join(directory, f"generatedAudio.wav"), "wb") as file:
                    file.write(response.content)
        
        else:
            log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Error generating image description. The status is: " + prediction.status +". \nGeneral prediction output: " + str(prediction))
            exit()
        log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Audio generation completed successfully.")
    except Exception as e:
        log_print(log_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Error in Audio Generation: {e}")

def main():
    load_dotenv()
    os.getenv("REPLICATE_API_TOKEN")

    # Create a directory with the current timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = f"generation/{timestamp}"
    os.makedirs(log_dir, exist_ok=True)
    log_file_path = os.path.join(log_dir, "log.txt")
    
    log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Starting Image Description...")
    run_image_description("installation/example_imgs/imageExample01.jpg", log_dir)

    log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Starting Image Generation...")
    run_image_generation(log_dir)

    log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Starting Audio Generation...")
    run_audio_generation(log_dir)

    log_print(log_file_path, f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Process completed.")

if __name__ == "__main__":
    main()
