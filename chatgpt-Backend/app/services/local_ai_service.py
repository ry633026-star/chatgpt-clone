import torch

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
)

from threading import Thread

from transformers import TextIteratorStreamer


MODEL_NAME = "Qwen/Qwen2.5-1.5B-Instruct"


print("Loading Qwen model...")

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME,
)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    dtype=torch.float16,
    device_map="auto",
)

model.eval()

print("Qwen model loaded successfully.")


def generate_local_response(
    messages: list[dict[str, str]],
) -> str:

    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
    ).to(model.device)

    with torch.no_grad():

        output = model.generate(
            **inputs,
            max_new_tokens=512,
            temperature=0.7,
            do_sample=True,
            top_p=0.9,
        )

    generated_tokens = output[0][inputs["input_ids"].shape[1] :]

    response = tokenizer.decode(
        generated_tokens,
        skip_special_tokens=True,
    )

    return response.strip()


def stream_local_response(
    messages: list[dict[str, str]],
):
    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
    ).to(model.device)

    streamer = TextIteratorStreamer(
        tokenizer,
        skip_prompt=True,
        skip_special_tokens=True,
    )

    generation_kwargs = {
        **inputs,
        "streamer": streamer,
        "max_new_tokens": 512,
        "temperature": 0.7,
        "do_sample": True,
        "top_p": 0.9,
    }

    thread = Thread(
        target=model.generate,
        kwargs=generation_kwargs,
    )

    thread.start()

    for text in streamer:
        if text:
            yield text

    thread.join()
