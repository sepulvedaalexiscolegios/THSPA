{
  "entities": {
    "Product": {
      "title": "Product",
      "description": "Store inventory products",
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "sku": { "type": "string" },
        "category": { "type": "string" },
        "subcategory": { "type": "string" },
        "stock": { "type": "number" },
        "minStock": { "type": "number" },
        "price": { "type": "number" },
        "imageUrl": { "type": "string" }
      },
      "required": ["name", "sku", "category", "stock", "price"]
    },
    "Customer": {
      "title": "Customer",
      "description": "Business customers",
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "rut": { "type": "string", "description": "Chilean RUT or custom code" },
        "email": { "type": "string" },
        "phone": { "type": "string" },
        "address": { "type": "string" },
        "coordinates": {
          "type": "object",
          "properties": {
            "lat": { "type": "number" },
            "lng": { "type": "number" }
          }
        }
      },
      "required": ["name", "rut"]
    },
    "Quotation": {
      "title": "Quotation",
      "description": "Customer price quotes",
      "type": "object",
      "properties": {
        "customerId": { "type": "string" },
        "customerName": { "type": "string" },
        "date": { "type": "string", "format": "date-time" },
        "items": { "type": "array" },
        "total": { "type": "number" },
        "status": { "type": "string", "enum": ["draft", "sent", "accepted", "rejected"] }
      },
      "required": ["customerId", "date", "items", "total", "status"]
    },
    "Sale": {
      "title": "Sale Ticket",
      "description": "Finalized sales from quotations",
      "type": "object",
      "properties": {
        "quotationId": { "type": "string" },
        "customerId": { "type": "string" },
        "date": { "type": "string", "format": "date-time" },
        "items": { "type": "array" },
        "total": { "type": "number" },
        "status": { "type": "string", "enum": ["paid", "shipping", "delivered"] }
      },
      "required": ["date", "items", "total", "status"]
    },
    "Category": {
      "title": "Category",
      "description": "Product categories",
      "type": "object",
      "properties": {
        "name": { "type": "string" }
      },
      "required": ["name"]
    },
    "Subcategory": {
      "title": "Subcategory",
      "description": "Product subcategories",
      "type": "object",
      "properties": {
        "parentId": { "type": "string" },
        "name": { "type": "string" }
      },
      "required": ["parentId", "name"]
    }
  },
  "firestore": {
    "/products/{productId}": {
      "schema": "Product",
      "description": "Collection of products"
    },
    "/customers/{customerId}": {
      "schema": "Customer",
      "description": "Collection of customers"
    },
    "/quotations/{quotationId}": {
      "schema": "Quotation",
      "description": "Collection of quotations"
    },
    "/sales/{saleId}": {
      "schema": "Sale",
      "description": "Collection of sales"
    },
    "/categories/{categoryId}": {
      "schema": "Category",
      "description": "Product categories"
    },
    "/subcategories/{subcategoryId}": {
      "schema": "Subcategory",
      "description": "Product subcategories"
    }
  }
}
