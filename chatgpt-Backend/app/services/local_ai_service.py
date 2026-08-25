import torch

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
)

from threading import Thread, Event

from transformers import TextIteratorStreamer, StoppingCriteria


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
    stop_event: Event,
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

    stopping_criteria = [StopGenerationCriteria(stop_event)]

    generation_kwargs = {
        **inputs,
        "streamer": streamer,
        "max_new_tokens": 512,
        "temperature": 0.7,
        "do_sample": True,
        "top_p": 0.9,
        "stopping_criteria": stopping_criteria,
    }

    thread = Thread(
        target=model.generate,
        kwargs=generation_kwargs,
    )

    thread.start()

    try:
        for text in streamer:

            if stop_event.is_set():
                break

            if text:
                yield text

    finally:
        stop_event.set()

        if thread.is_alive():
            thread.join(timeout=2)


# stop criteria
class StopGenerationCriteria(StoppingCriteria):
    def __init__(self, stop_event: Event):
        self.stop_event = stop_event

    def __call__(
        self,
        input_ids,
        scores,
        **kwargs,
    ):
        return self.stop_event.is_set()
