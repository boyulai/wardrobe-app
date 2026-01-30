import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from rembg import remove
from PIL import Image
import io
import google.generativeai as genai

app = FastAPI()

# Config
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
PROCESSED_DIR = Path("processed")
PROCESSED_DIR.mkdir(exist_ok=True)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/processed", StaticFiles(directory="processed"), name="processed")

class ClothingItem(BaseModel):
    id: str
    tags: List[str]
    category: Optional[str] = None
    description: Optional[str] = None
    wardrobe: str = "default"  # Add wardrobe field

class RecommendationRequest(BaseModel):
    items: List[ClothingItem]
    style: str
    api_key: str

@app.get("/api/items")
def get_items(wardrobe: str = "default"):
    all_items = load_db()
    # Filter by wardrobe if needed, currently returning all but handled in frontend
    # Or better, filter here:
    return [item for item in all_items if item.get("wardrobe", "default") == wardrobe]

@app.get("/api/wardrobes")
def get_wardrobes():
    db = load_db()
    wardrobes = set(item.get("wardrobe", "default") for item in db)
    return list(wardrobes)

@app.post("/api/upload")
async def upload_image(
    file: UploadFile = File(...),
    api_key: str = Form(...),
    wardrobe: str = Form("default")
):
    try:
        # 1. Read and Save Original
        file_id = str(uuid.uuid4())
        original_filename = f"{file_id}_orig{Path(file.filename).suffix}"
        original_path = UPLOAD_DIR / original_filename
        
        content = await file.read()
        with open(original_path, "wb") as f:
            f.write(content)
            
        # 2. Remove Background (Rembg)
        input_image = Image.open(io.BytesIO(content))
        output_image = remove(input_image)
        
        # Convert to RGB (white background) from RGBA
        # Create a white background image
        white_bg = Image.new("RGBA", output_image.size, "WHITE")
        # Paste the image on top
        white_bg.paste(output_image, (0, 0), output_image)
        final_image = white_bg.convert("RGB")
        
        processed_filename = f"{file_id}.jpg"
        processed_path = PROCESSED_DIR / processed_filename
        final_image.save(processed_path, quality=95)
        
        # 3. Analyze with Gemini
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash') # Or gemini-pro-vision
        
        prompt = """
        Analyze this clothing item image. 
        Return a JSON object with the following fields:
        - category: (e.g., 上衣, 下著, 鞋子, 配件) - Use Traditional Chinese
        - sub_category: (e.g., T-shirt, 牛仔褲, 運動鞋) - Use Traditional Chinese
        - color: dominant color in Traditional Chinese
        - style: (e.g., 休閒, 正式, 運動, 復古) - Use Traditional Chinese
        - season: (e.g., 夏季, 冬季, 四季皆宜) - Use Traditional Chinese
        - tags: a list of 3-5 keywords describing the item in Traditional Chinese
        
        Output ONLY the JSON string.
        """
        
        response = model.generate_content([prompt, final_image])
        analysis_text = response.text
        # Simple cleanup to ensure valid JSON if markdown blocks are present
        if "```json" in analysis_text:
            analysis_text = analysis_text.split("```json")[1].split("```")[0]
        elif "```" in analysis_text:
             analysis_text = analysis_text.split("```")[1].split("```")[0]
             
        import json
        analysis = {}
        try:
            analysis = json.loads(analysis_text)
        except:
            analysis = {"error": "Failed to parse AI response", "raw": analysis_text}

        return {
            "id": file_id,
            "original_url": f"/uploads/{original_filename}",
            "processed_url": f"/processed/{processed_filename}",
            "analysis": analysis,
            "category": analysis.get("category", "Unknown"),
            "tags": analysis.get("tags", []),
            "description": f"{analysis.get('color', '')} {analysis.get('sub_category', '')}",
            "wardrobe": wardrobe
        }

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recommend")
async def recommend_outfit(req: RecommendationRequest):
    try:
        genai.configure(api_key=req.api_key)
        model = genai.GenerativeModel('gemini-1.5-pro')
        
        items_desc = "\n".join([f"- ID {item.id}: {item.category} ({item.description}) tags: {', '.join(item.tags)}" for item in req.items])
        
        prompt = f"""
        I have the following clothing items in my wardrobe:
        {items_desc}
        
        Please suggest 3 different outfit combinations based on the style "{req.style}".
        For each outfit, list the items used (by ID and name) and explain why they work together.
        Format the output as Markdown.
        """
        
        response = model.generate_content(prompt)
        return {"recommendation": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
