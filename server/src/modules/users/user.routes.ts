import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { imageUpload } from '../../middleware/upload.js';
import { idParamSchema, listUsersSchema, updateProfileSchema } from './user.schema.js';
import * as controller from './user.controller.js';

const router = Router();
const avatars = imageUpload('avatars');

router.use(requireAuth);

router.get('/', validate({ query: listUsersSchema }), asyncHandler(controller.listUsers));
router.get('/suggestions', asyncHandler(controller.suggestions));
router.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(controller.updateProfile));
router.patch('/me/avatar', avatars.single('avatar'), asyncHandler(controller.updateAvatar));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getUser));

export default router;
