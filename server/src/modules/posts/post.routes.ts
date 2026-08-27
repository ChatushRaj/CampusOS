import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { imageUpload } from '../../middleware/upload.js';
import {
  commentParamsSchema,
  commentSchema,
  createPostSchema,
  idParamSchema,
  listPostsSchema,
  updatePostSchema,
} from './post.schema.js';
import * as controller from './post.controller.js';

const router = Router();
const images = imageUpload('posts');

router.use(requireAuth);

router.get('/', validate({ query: listPostsSchema }), asyncHandler(controller.listPosts));
router.post(
  '/',
  writeLimiter,
  images.array('images', 4),
  validate({ body: createPostSchema }),
  asyncHandler(controller.createPost),
);

router.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getPost));
router.patch('/:id', validate({ params: idParamSchema, body: updatePostSchema }), asyncHandler(controller.updatePost));
router.delete('/:id', validate({ params: idParamSchema }), asyncHandler(controller.deletePost));

router.post('/:id/like', writeLimiter, validate({ params: idParamSchema }), asyncHandler(controller.likePost));
router.post('/:id/bookmark', validate({ params: idParamSchema }), asyncHandler(controller.bookmarkPost));

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
