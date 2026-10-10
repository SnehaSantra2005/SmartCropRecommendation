
import pandas as pd
import joblib

import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report
)

# 1. Load dataset
df = pd.read_csv("data/Crop_recommendation.csv")

# 2. Separate input features and target
X = df.drop("label", axis=1)
y = df["label"]

# 3. Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# 4. Define three ML models
models = {
    "Decision Tree": DecisionTreeClassifier(random_state=42),

    "Random Forest": RandomForestClassifier(
        n_estimators=100,
        random_state=42
    ),

    "KNN": Pipeline([
        ("scaler", StandardScaler()),
        ("knn", KNeighborsClassifier(n_neighbors=5))
    ])
}

results = []
trained_models = {}

# 5. Train and compare models
for name, model in models.items():
    print(f"\nTraining {name}...")

    # Cross-validation using training data only
    cv_scores = cross_val_score(
        model,
        X_train,
        y_train,
        cv=5,
        scoring="accuracy"
    )

    # Train on the complete training set
    model.fit(X_train, y_train)

    # Predict using unseen test data
    y_pred = model.predict(X_test)

    # Calculate evaluation metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(
        y_test, y_pred, average="macro", zero_division=0
    )
    recall = recall_score(
        y_test, y_pred, average="macro", zero_division=0
    )
    f1 = f1_score(
        y_test, y_pred, average="macro", zero_division=0
    )

    results.append({
        "Model": name,
        "CV Accuracy (%)": round(cv_scores.mean() * 100, 2),
        "Test Accuracy (%)": round(accuracy * 100, 2),
        "Precision (%)": round(precision * 100, 2),
        "Recall (%)": round(recall * 100, 2),
        "F1-score (%)": round(f1 * 100, 2)
    })

    trained_models[name] = model

# 6. Display comparison table
results_df = pd.DataFrame(results)

print("\n--- MODEL COMPARISON ---")
print(results_df.to_string(index=False))

# 7. Select model with the highest cross-validation accuracy
best_name = max(
    results,
    key=lambda item: item["CV Accuracy (%)"]
)["Model"]

best_model = trained_models[best_name]

print(f"\nBest model based on cross-validation: {best_name}")

# 8. Show detailed test results for the selected model
best_predictions = best_model.predict(X_test)

print("\nClassification Report:")
print(classification_report(y_test, best_predictions))

# 9. Save the selected model
joblib.dump(best_model, "models/crop_model.pkl")

print(f"\nBest model ({best_name}) saved successfully!")


# 10. Create model comparison graph
plt.figure(figsize=(9, 5))

sns.barplot(
    data=results_df,
    x="Model",
    y="Test Accuracy (%)"
)

plt.title("ML Model Accuracy Comparison")
plt.ylabel("Test Accuracy (%)")
plt.xlabel("Machine Learning Algorithm")
plt.ylim(90, 100)
plt.tight_layout()

plt.savefig(
    "static/images/model_comparison.png",
    dpi=300
)
plt.close()

print("Model comparison graph saved!")


# 11. Create confusion matrix
cm = confusion_matrix(
    y_test,
    best_predictions,
    labels=best_model.classes_
)

plt.figure(figsize=(14, 11))

sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    cmap="Greens",
    xticklabels=best_model.classes_,
    yticklabels=best_model.classes_
)

plt.title(f"Confusion Matrix - {best_name}")
plt.xlabel("Predicted Crop")
plt.ylabel("Actual Crop")
plt.xticks(rotation=90)
plt.yticks(rotation=0)
plt.tight_layout()

plt.savefig(
    "static/images/confusion_matrix.png",
    dpi=300
)
plt.close()

print("Confusion matrix saved!")


# 12. Feature importance (if supported by the model)
if hasattr(best_model, "feature_importances_"):
    importance = pd.DataFrame({
        "Feature": X.columns,
        "Importance": best_model.feature_importances_
    }).sort_values("Importance", ascending=False)

    print("\nFeature Importance:")
    print(importance.to_string(index=False))

    plt.figure(figsize=(9, 5))

    sns.barplot(
        data=importance,
        x="Importance",
        y="Feature"
    )

    plt.title(f"Feature Importance - {best_name}")
    plt.tight_layout()

    plt.savefig(
        "static/images/feature_importance.png",
        dpi=300
    )
    plt.close()

    print("Feature importance graph saved!")
else:
    print("Feature importance is not available for this model.")