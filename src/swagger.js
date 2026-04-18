const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Facebook Page API Backend",
      version: "1.0.0",
      description:
        "API trung gian Node.js de lam viec voi Facebook Graph API cho Facebook Page"
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server"
      }
    ],
    tags: [
      { name: "Health", description: "Trang thai server" },
      { name: "Page", description: "Thong tin va bai viet cua page" },
      { name: "Post", description: "Tac vu tren bai viet" },
      { name: "Insights", description: "Chi so thong ke page" }
    ],
    components: {
      parameters: {
        AccessTokenQuery: {
          name: "access_token",
          in: "query",
          required: false,
          description:
            "Page access token. Neu khong truyen, server se lay tu header x-page-access-token hoac bien moi truong PAGE_ACCESS_TOKEN.",
          schema: {
            type: "string"
          }
        }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
            hint: { type: "string" },
            details: {
              type: "object",
              additionalProperties: true
            }
          }
        },
        CreatePostBody: {
          type: "object",
          properties: {
            message: { type: "string", example: "Hello from API" },
            link: { type: "string", example: "https://example.com" },
            published: { type: "boolean", example: true }
          }
        }
      }
    },
    paths: {
      "/": {
        get: {
          tags: ["Health"],
          summary: "Kiem tra server",
          responses: {
            200: {
              description: "Server status"
            }
          }
        }
      },
      "/api/page/{pageId}": {
        get: {
          tags: ["Page"],
          summary: "Lay thong tin page",
          parameters: [
            {
              name: "pageId",
              in: "path",
              required: true,
              schema: { type: "string" }
            },
            { $ref: "#/components/parameters/AccessTokenQuery" },
            {
              name: "fields",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Danh sach fields cua Graph API"
            }
          ],
          responses: {
            200: { description: "Thong tin page" },
            400: {
              description: "Thieu token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },
      "/api/page/{pageId}/posts": {
        get: {
          tags: ["Page"],
          summary: "Lay danh sach post cua page",
          parameters: [
            {
              name: "pageId",
              in: "path",
              required: true,
              schema: { type: "string" }
            },
            { $ref: "#/components/parameters/AccessTokenQuery" },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 10 }
            },
            {
              name: "fields",
              in: "query",
              required: false,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: { description: "Danh sach post" },
            400: {
              description: "Thieu token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        },
        post: {
          tags: ["Page"],
          summary: "Dang bai moi len page",
          parameters: [
            {
              name: "pageId",
              in: "path",
              required: true,
              schema: { type: "string" }
            },
            { $ref: "#/components/parameters/AccessTokenQuery" }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatePostBody" }
              }
            }
          },
          responses: {
            201: { description: "Tao post thanh cong" },
            400: {
              description: "Body hoac token khong hop le",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },
      "/api/page/post/{postId}": {
        delete: {
          tags: ["Post"],
          summary: "Xoa bai viet theo postId",
          parameters: [
            {
              name: "postId",
              in: "path",
              required: true,
              schema: { type: "string" }
            },
            { $ref: "#/components/parameters/AccessTokenQuery" }
          ],
          responses: {
            200: { description: "Xoa thanh cong" },
            400: {
              description: "Thieu token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },
      "/api/page/post/{postId}/comments": {
        get: {
          tags: ["Post"],
          summary: "Lay comments cua bai viet",
          parameters: [
            {
              name: "postId",
              in: "path",
              required: true,
              schema: { type: "string" }
            },
            { $ref: "#/components/parameters/AccessTokenQuery" },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 25 }
            },
            {
              name: "fields",
              in: "query",
              required: false,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: { description: "Danh sach comments" },
            400: {
              description: "Thieu token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },
      "/api/page/post/{postId}/likes": {
        get: {
          tags: ["Post"],
          summary: "Lay likes cua bai viet",
          parameters: [
            {
              name: "postId",
              in: "path",
              required: true,
              schema: { type: "string" }
            },
            { $ref: "#/components/parameters/AccessTokenQuery" },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 25 }
            },
            {
              name: "fields",
              in: "query",
              required: false,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: { description: "Danh sach likes" },
            400: {
              description: "Thieu token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },
      "/api/page/{pageId}/insights": {
        get: {
          tags: ["Insights"],
          summary: "Lay insights cua page",
          parameters: [
            {
              name: "pageId",
              in: "path",
              required: true,
              schema: { type: "string" }
            },
            { $ref: "#/components/parameters/AccessTokenQuery" },
            {
              name: "metric",
              in: "query",
              required: false,
              schema: { type: "string" }
            },
            {
              name: "period",
              in: "query",
              required: false,
              schema: { type: "string", default: "day" }
            }
          ],
          responses: {
            200: { description: "Insights data" },
            400: {
              description: "Thieu token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: []
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
