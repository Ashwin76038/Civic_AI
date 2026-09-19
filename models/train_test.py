import os
import cv2
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import datasets, models, transforms
from torchvision.models import MobileNet_V2_Weights
from torch.utils.data.sampler import WeightedRandomSampler
from torch.optim.lr_scheduler import ReduceLROnPlateau
from PIL import Image
import numpy as np

# Define paths and parameters
processed_dataset_path = os.path.join(os.path.dirname(__file__), "processed_dataset")
categories = ["drainage", "pothole", "garbage_waste"]
batch_size = 8
num_epochs = 20
target_size = (224, 224)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Create necessary directories if they don't exist
for split in ['train', 'val']:
    for category in categories:
        os.makedirs(os.path.join(processed_dataset_path, split, category), exist_ok=True)

# Data augmentation
train_transforms = transforms.Compose([
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomVerticalFlip(p=0.5),
    transforms.RandomRotation(45),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
    transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
    transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), shear=10),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

val_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# Binary dataset class
class BinaryDataset(Dataset):
    def __init__(self, dataset, target_class_idx):
        self.dataset = dataset
        self.target_class_idx = target_class_idx

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, idx):
        img, label = self.dataset[idx]
        binary_label = 1 if label == self.target_class_idx else 0
        return img, binary_label

# Create model
def create_binary_model():
    model = models.mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1)
    for param in model.features.parameters():
        param.requires_grad = False
    for param in model.features[-2:].parameters():
        param.requires_grad = True
    model.classifier = nn.Sequential(
        nn.Linear(1280, 512),
        nn.ReLU(),
        nn.Dropout(0.4),
        nn.Linear(512, 2)
    )
    return model.to(device)

# Training function
def train_model(model, train_loader, val_loader, category):
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=2, min_lr=1e-6)

    best_val_loss = float("inf")
    patience = 5
    patience_counter = 0

    for epoch in range(num_epochs):
        model.train()
        running_loss, running_corrects = 0.0, 0
        for inputs, labels in train_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * inputs.size(0)
            preds = torch.max(outputs, 1)[1]
            running_corrects += torch.sum(preds == labels.data)

        epoch_loss = running_loss / len(train_loader.dataset)
        epoch_acc = running_corrects.double() / len(train_loader.dataset)

        model.eval()
        val_loss, val_corrects = 0.0, 0
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * inputs.size(0)
                preds = torch.max(outputs, 1)[1]
                val_corrects += torch.sum(preds == labels.data)

        val_loss = val_loss / len(val_loader.dataset)
        val_acc = val_corrects.double() / len(val_loader.dataset)

        print(f"Epoch {epoch+1}/{num_epochs}, Train Loss: {epoch_loss:.4f}, Train Acc: {epoch_acc:.2%}, "
              f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2%}")

        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), f"{category}_model.pth")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch+1}")
                break

    if torch.cuda.is_available():
        torch.cuda.empty_cache()

# Inference function
def predict_image(model, image_path, category):
    try:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Failed to load image")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        img_tensor = transform(Image.fromarray(img)).unsqueeze(0).to(device)
        model.eval()
        with torch.no_grad():
            outputs = model(img_tensor)
            probs = torch.softmax(outputs, dim=1)
            pred = torch.max(probs, 1)[1].item()
            confidence = probs[0][pred].item()
            if pred == 1:
                if confidence >= 0.7:
                    return f"Yes, this is a {category}."
                else:
                    return f"It might be a {category}, but the image is unclear. Please upload a clearer photo."
            else:
                return f"This is not a {category}."
    except Exception as e:
        raise e

# Train models
for category in categories:
    print(f"\nTraining model for {category}")
    train_dataset = datasets.ImageFolder(os.path.join(processed_dataset_path, "train"), transform=train_transforms)
    val_dataset = datasets.ImageFolder(os.path.join(processed_dataset_path, "val"), transform=val_transforms)
    class_to_idx = train_dataset.class_to_idx
    target_class_idx = class_to_idx[category]

    binary_train_dataset = BinaryDataset(train_dataset, target_class_idx)
    binary_val_dataset = BinaryDataset(val_dataset, target_class_idx)

    train_loader = DataLoader(binary_train_dataset, batch_size=batch_size, sampler=WeightedRandomSampler(
        [1.0] * len(binary_train_dataset), len(binary_train_dataset), replacement=True), num_workers=0)
    val_loader = DataLoader(binary_val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    model = create_binary_model()
    train_model(model, train_loader, val_loader, category)

# Inference loop
print("\nTraining complete. Now starting inference.")
print("Welcome to the image classification system.")
print("Upload an image and select a category to check if the image belongs to that category.")
print("Enter 'quit' at any time to exit.")

while True:
    image_path = input("\nEnter image path (or 'quit' to exit): ")
    if image_path.lower() == "quit":
        break
    if not os.path.exists(image_path):
        print("Invalid image path! Please try again.")
        continue

    print("\nSelect category:")
    for i, cat in enumerate(categories, 1):
        print(f"{i}. {cat.capitalize()}")
    while True:
        category_num = input("Enter number (1-3): ")
        try:
            category_index = int(category_num) - 1
            if 0 <= category_index < len(categories):
                category = categories[category_index]
                break
            else:
                print("Invalid number. Please enter 1, 2, or 3.")
        except ValueError:
            print("Invalid input. Please enter a number.")

    model_path = f"{category}_model.pth"
    if not os.path.exists(model_path):
        print(f"Model for {category} not found! Please ensure the model is trained.")
        continue

    try:
        model = create_binary_model()
        model.load_state_dict(torch.load(model_path))
        model.to(device)
        result = predict_image(model, image_path, category)
        print(result)
    except Exception as e:
        print(f"Error during inference: {e}")

print("Thank you for using the image classification system!")
