import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { imageUpload } from '../../middleware/upload.js';
import {
  commentParamsSchema,
  commentSchema,
  createBlogSchema,
  idParamSchema,
  listBlogsSchema,
  updateBlogSchema,
} from './blog.schema.js';
import * as controller from './blog.controller.js';

const router = Router();
const covers = imageUpload('blogs');

router.use(requireAuth);

router.get('/', validate({ query: listBlogsSchema }), asyncHandler(controller.listBlogs));
router.post(
  '/',
  writeLimiter,
  covers.single('cover'),
  validate({ body: createBlogSchema }),
  asyncHandler(controller.createBlog),
);

router.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getBlog));
router.patch(
  '/:id',
  covers.single('cover'),
  validate({ params: idParamSchema, body: updateBlogSchema }),
  asyncHandler(controller.updateBlog),
);
router.delete('/:id', validate({ params: idParamSchema }), asyncHandler(controller.deleteBlog));

router.post('/:id/like', writeLimiter, validate({ params: idParamSchema }), asyncHandler(controller.likeBlog));
router.post('/:id/bookmark', validate({ params: idParamSchema }), asyncHandler(controller.bookmarkBlog));

router.get('/:id/comments', validate({ params: idParamSchema }), asyncHandler(controller.listComments));
router.post(
  '/:id/comments',
  writeLimiter,
  validate({ params: idParamSchema, body: commentSchema }),
  asyncHandler(controller.addComment),
);
router.delete(
  '/:id/comments/:commentId',
  validate({ params: commentParamsSchema }),
  asyncHandler(controller.deleteComment),
);

export default router;
