rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() {
      return request.auth != null && request.auth.token.email_verified == true;
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    match /products/{productId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && isValidId(productId);
      allow delete: if isSignedIn();
    }

    match /customers/{customerId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && isValidId(customerId);
      allow delete: if isSignedIn();
    }

    match /quotations/{quotationId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && isValidId(quotationId);
      allow delete: if isSignedIn();
    }

    match /sales/{saleId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && isValidId(saleId);
      allow delete: if isSignedIn();
    }

    match /categories/{categoryId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
    }

    match /subcategories/{subcategoryId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
    }
    
    match /test/connection {
      allow read: if true;
    }
  }
}
