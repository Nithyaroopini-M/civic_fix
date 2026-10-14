"""
CivicFix – Image Classifier Training
Model  : EfficientNetB0 (transfer learning, ImageNet weights)
Input  : 224x224 RGB
Classes: 5  (cracks, garbage, open_manhole, pothole, water_overflow)

Run on your GPU machine:
    pip install tensorflow pillow scikit-learn matplotlib
    python train.py

Outputs (saved to ml/model/):
    best_model.keras        – best checkpoint by val_accuracy
    final_model.keras       – after full training
    class_names.json        – label index mapping
    training_history.png    – loss / accuracy curves
"""

import os, json, shutil
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# ── config ─────────────────────────────────────────────────────────
IMG_SIZE    = 224
BATCH_SIZE  = 32
EPOCHS_HEAD = 10      # train only top layers first
EPOCHS_FINE = 20      # then unfreeze bottom layers
LR_HEAD     = 1e-3
LR_FINE     = 1e-5
SEED        = 42

BASE   = os.path.dirname(__file__)
DS_DIR = os.path.join(BASE, "dataset")
OUT    = os.path.join(BASE, "model")
os.makedirs(OUT, exist_ok=True)
# ───────────────────────────────────────────────────────────────────

# ── 1. Data generators ─────────────────────────────────────────────
train_aug = ImageDataGenerator(
    rescale=1./255,
    rotation_range=20,
    width_shift_range=0.15,
    height_shift_range=0.15,
    shear_range=0.10,
    zoom_range=0.20,
    horizontal_flip=True,
    brightness_range=[0.8, 1.2],
    fill_mode="nearest",
)
val_aug = ImageDataGenerator(rescale=1./255)

train_gen = train_aug.flow_from_directory(
    os.path.join(DS_DIR, "train"),
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    seed=SEED,
)
val_gen = val_aug.flow_from_directory(
    os.path.join(DS_DIR, "val"),
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    seed=SEED,
)
test_gen = val_aug.flow_from_directory(
    os.path.join(DS_DIR, "test"),
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    shuffle=False,
)

NUM_CLASSES  = len(train_gen.class_indices)
CLASS_NAMES  = {v: k for k, v in train_gen.class_indices.items()}
print(f"Classes ({NUM_CLASSES}): {train_gen.class_indices}")

# Save label map
label_map = {"class_names": CLASS_NAMES, "class_indices": train_gen.class_indices}
with open(os.path.join(OUT, "class_names.json"), "w") as f:
    json.dump(label_map, f, indent=2)

# ── 2. Build model ──────────────────────────────────────────────────
base_model = EfficientNetB0(
    include_top=False,
    weights="imagenet",
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
)
base_model.trainable = False          # freeze for head training

inputs = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
x = base_model(inputs, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.BatchNormalization()(x)
x = layers.Dropout(0.4)(x)
x = layers.Dense(256, activation="relu")(x)
x = layers.Dropout(0.3)(x)
outputs = layers.Dense(NUM_CLASSES, activation="softmax")(x)

model = keras.Model(inputs, outputs)
model.summary()

# ── 3. Phase 1: train head only ─────────────────────────────────────
model.compile(
    optimizer=keras.optimizers.Adam(LR_HEAD),
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

callbacks_head = [
    keras.callbacks.ModelCheckpoint(
        os.path.join(OUT, "best_model.keras"),
        monitor="val_accuracy", save_best_only=True, verbose=1,
    ),
    keras.callbacks.EarlyStopping(
        monitor="val_accuracy", patience=5, restore_best_weights=True,
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss", factor=0.5, patience=3, verbose=1,
    ),
]

print("\n=== Phase 1: Training classifier head ===")
history1 = model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=EPOCHS_HEAD,
    callbacks=callbacks_head,
)

# ── 4. Phase 2: fine-tune top layers ────────────────────────────────
base_model.trainable = True
# Freeze all but the last 30 layers of EfficientNetB0
for layer in base_model.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=keras.optimizers.Adam(LR_FINE),
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

callbacks_fine = [
    keras.callbacks.ModelCheckpoint(
        os.path.join(OUT, "best_model.keras"),
        monitor="val_accuracy", save_best_only=True, verbose=1,
    ),
    keras.callbacks.EarlyStopping(
        monitor="val_accuracy", patience=8, restore_best_weights=True,
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss", factor=0.3, patience=4, verbose=1,
    ),
]

print("\n=== Phase 2: Fine-tuning top layers ===")
history2 = model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=EPOCHS_FINE,
    callbacks=callbacks_fine,
)

# Save final model
model.save(os.path.join(OUT, "final_model.keras"))
print(f"Models saved to {OUT}")

# ── 5. Evaluate on test set ─────────────────────────────────────────
print("\n=== Test set evaluation ===")
loss, acc = model.evaluate(test_gen)
print(f"Test accuracy: {acc:.4f}   Loss: {loss:.4f}")

# Confusion matrix
from sklearn.metrics import classification_report, confusion_matrix
test_gen.reset()
preds = model.predict(test_gen)
y_pred = np.argmax(preds, axis=1)
y_true = test_gen.classes
names  = list(test_gen.class_indices.keys())
print("\nClassification Report:")
print(classification_report(y_true, y_pred, target_names=names))

# ── 6. Plot training curves ─────────────────────────────────────────
def merge_hist(h1, h2, key):
    return h1.history.get(key, []) + h2.history.get(key, [])

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
for ax, metric, title in zip(
    axes,
    [("accuracy","val_accuracy"), ("loss","val_loss")],
    ["Accuracy", "Loss"],
):
    train_vals = merge_hist(history1, history2, metric[0])
    val_vals   = merge_hist(history1, history2, metric[1])
    ax.plot(train_vals, label="Train")
    ax.plot(val_vals,   label="Val")
    ax.set_title(title); ax.set_xlabel("Epoch"); ax.legend()

plt.tight_layout()
plt.savefig(os.path.join(OUT, "training_history.png"), dpi=100)
print(f"Training curves saved.")
