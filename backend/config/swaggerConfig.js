import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

dotenv.config();

const BE_API = process.env.BE_API

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MangaShop API',
            version: '1.0.0',
            description: 'API documentation cho MangaShop — web bán truyện tranh',
        },
        servers: [
            {
                url: BE_API,
                description: 'Local development',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        _id:      { type: 'string', example: '664f1b2c9e1a2b3c4d5e6f7a' },
                        username: { type: 'string', example: 'nguyenvana' },
                        email:    { type: 'string', example: 'user@example.com' },
                        fullName: { type: 'string', example: 'Nguyễn Văn A' },
                        phone:    { type: 'string', example: '0901234567' },
                        role:     { type: 'string', enum: ['customer', 'admin'], example: 'customer' },
                        isActive: { type: 'boolean', example: true },
                        address: {
                            type: 'object',
                            properties: {
                                province: { type: 'string', example: 'TP. Hồ Chí Minh' },
                                district: { type: 'string', example: 'Quận 1' },
                                ward:     { type: 'string', example: 'Phường Bến Nghé' },
                                street:   { type: 'string', example: '123 Lê Lợi' },
                            },
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', example: 'Lỗi máy chủ.' },
                    },
                },
            },
        },
    },
    // Đường dẫn tới các file chứa JSDoc comments
    apis: ['./routes/*.js', './controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;