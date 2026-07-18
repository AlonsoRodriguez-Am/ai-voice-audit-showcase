from typing import Any, Dict

# Common error responses for OpenAPI documentation
ERROR_RESPONSES: Dict[int | str, Dict[str, Any]] = {
    400: {
        "description": "Bad Request - Invalid input data",
        "content": {
            "application/json": {
                "example": {"detail": "Missing required field: email"}
            }
        },
    },
    401: {
        "description": "Unauthorized - Authentication required or invalid token",
        "content": {
            "application/json": {
                "example": {"detail": "Could not validate credentials"}
            }
        },
    },
    403: {
        "description": "Forbidden - Insufficient permissions",
        "content": {
            "application/json": {
                "example": {"detail": "Insufficient permissions to access this resource"}
            }
        },
    },
    404: {
        "description": "Not Found - Resource does not exist",
        "content": {
            "application/json": {
                "example": {"detail": "User not found"}
            }
        },
    },
    422: {
        "description": "Unprocessable Entity - Validation error",
        "content": {
            "application/json": {
                "example": {
                    "detail": [
                        {
                            "loc": ["body", "email"],
                            "msg": "value is not a valid email address",
                            "type": "value_error.email"
                        }
                    ]
                }
            }
        },
    },
    500: {
        "description": "Internal Server Error - Unexpected server error",
        "content": {
            "application/json": {
                "example": {"detail": "An internal error occurred while processing the request"}
            }
        },
    },
}
