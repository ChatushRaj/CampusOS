-- =====================================================================
--  CampusOS — MySQL schema
--  Author: Chatush Raj
--
--  Run this once against an empty database:
--      mysql -u root -p < sql/schema.sql
--
--  Design notes
--  ------------
--  * InnoDB throughout, so foreign keys and transactions are enforced.
--  * utf8mb4 so names, emoji and Indic scripts all store correctly.
--  * Likes, bookmarks and comments get one table per parent instead of a
--    polymorphic (target_type, target_id) pair. A polymorphic column cannot
--    carry a foreign key, which makes orphaned rows possible the moment a
--    parent is deleted. One table per parent keeps integrity in the database.
--  * Money is DECIMAL, never FLOAT.
--  * Counter columns (like_count, comment_count) are denormalised on purpose:
--    they keep the feed to a single query. Every write that changes one runs
--    inside a transaction with the row it counts.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS campusos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE campusos;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(80)  NOT NULL,
  email           VARCHAR(160) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('student','faculty','admin') NOT NULL DEFAULT 'student',
  roll_number     VARCHAR(24)  DEFAULT NULL,
  department      VARCHAR(80)  DEFAULT NULL,
  graduation_year SMALLINT     DEFAULT NULL,
  headline        VARCHAR(120) NOT NULL DEFAULT '',
  bio             VARCHAR(600) NOT NULL DEFAULT '',
  avatar_path     VARCHAR(255) DEFAULT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Incremented on password change to retire every refresh token issued before it.
  token_version   INT          NOT NULL DEFAULT 0,
  last_seen_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  UNIQUE KEY users_roll_number_unique (roll_number),
  KEY users_role_idx (role),
  KEY users_department_year_idx (department, graduation_year),
  KEY users_name_idx (name),
  CONSTRAINT users_graduation_year_chk CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1950 AND 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_interests (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id  INT UNSIGNED NOT NULL,
  interest VARCHAR(30)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY user_interests_unique (user_id, interest),
  KEY user_interests_lookup (interest),
  CONSTRAINT user_interests_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Shared tag vocabulary
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tags (
  id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(30)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY tags_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS posts (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id     INT UNSIGNED NOT NULL,
  body          TEXT         NOT NULL,
  visibility    ENUM('campus','connections') NOT NULL DEFAULT 'campus',
  like_count    INT          NOT NULL DEFAULT 0,
  comment_count INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY posts_created_idx (created_at),
  KEY posts_author_created_idx (author_id, created_at),
  CONSTRAINT posts_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT posts_like_count_chk CHECK (like_count >= 0),
  CONSTRAINT posts_comment_count_chk CHECK (comment_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_images (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id  INT UNSIGNED NOT NULL,
  path     VARCHAR(255) NOT NULL,
  position SMALLINT     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY post_images_post_idx (post_id, position),
  CONSTRAINT post_images_post_fk FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INT UNSIGNED NOT NULL,
  tag_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  KEY post_tags_tag_idx (tag_id),
  CONSTRAINT post_tags_post_fk FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT post_tags_tag_fk  FOREIGN KEY (tag_id)  REFERENCES tags (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS blogs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id     INT UNSIGNED NOT NULL,
  title         VARCHAR(140) NOT NULL,
  slug          VARCHAR(160) NOT NULL,
  excerpt       VARCHAR(300) NOT NULL DEFAULT '',
  body          TEXT         NOT NULL,
  cover_path    VARCHAR(255) DEFAULT NULL,
  read_minutes  SMALLINT     NOT NULL DEFAULT 1,
  published     BOOLEAN      NOT NULL DEFAULT TRUE,
  like_count    INT          NOT NULL DEFAULT 0,
  comment_count INT          NOT NULL DEFAULT 0,
  view_count    INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY blogs_slug_unique (slug),
  KEY blogs_created_idx (created_at),
  KEY blogs_author_idx (author_id),
  KEY blogs_popular_idx (published, like_count),
  CONSTRAINT blogs_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_tags (
  blog_id INT UNSIGNED NOT NULL,
  tag_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (blog_id, tag_id),
  KEY blog_tags_tag_idx (tag_id),
  CONSTRAINT blog_tags_blog_fk FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE,
  CONSTRAINT blog_tags_tag_fk  FOREIGN KEY (tag_id)  REFERENCES tags (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Engagement — one table per parent so every row has a real foreign key
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS post_likes (
  user_id    INT UNSIGNED NOT NULL,
  post_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  KEY post_likes_post_idx (post_id),
  CONSTRAINT post_likes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT post_likes_post_fk FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_likes (
  user_id    INT UNSIGNED NOT NULL,
  blog_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, blog_id),
  KEY blog_likes_blog_idx (blog_id),
  CONSTRAINT blog_likes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT blog_likes_blog_fk FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_comments (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  post_id    INT UNSIGNED  NOT NULL,
  author_id  INT UNSIGNED  NOT NULL,
  body       VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY post_comments_post_idx (post_id, created_at),
  KEY post_comments_author_idx (author_id),
  CONSTRAINT post_comments_post_fk   FOREIGN KEY (post_id)   REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT post_comments_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_comments (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  blog_id    INT UNSIGNED  NOT NULL,
  author_id  INT UNSIGNED  NOT NULL,
  body       VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY blog_comments_blog_idx (blog_id, created_at),
  KEY blog_comments_author_idx (author_id),
  CONSTRAINT blog_comments_blog_fk   FOREIGN KEY (blog_id)   REFERENCES blogs (id) ON DELETE CASCADE,
  CONSTRAINT blog_comments_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_bookmarks (
  user_id    INT UNSIGNED NOT NULL,
  post_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  KEY post_bookmarks_recent_idx (user_id, created_at),
  CONSTRAINT post_bookmarks_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT post_bookmarks_post_fk FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_bookmarks (
  user_id    INT UNSIGNED NOT NULL,
  blog_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, blog_id),
  KEY blog_bookmarks_recent_idx (user_id, created_at),
  CONSTRAINT blog_bookmarks_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT blog_bookmarks_blog_fk FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Notices
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notices (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  posted_by      INT UNSIGNED NOT NULL,
  title          VARCHAR(160) NOT NULL,
  body           TEXT         NOT NULL,
  category       ENUM('academic','examination','placement','facility','general') NOT NULL DEFAULT 'general',
  priority       ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal',
  attachment_url VARCHAR(500) DEFAULT NULL,
  -- NULL means the notice stays on the board indefinitely.
  expires_at     DATETIME     DEFAULT NULL,
  pinned         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY notices_board_idx (pinned, created_at),
  KEY notices_category_idx (category),
  KEY notices_expiry_idx (expires_at),
  CONSTRAINT notices_posted_by_fk FOREIGN KEY (posted_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organiser_id     INT UNSIGNED NOT NULL,
  title            VARCHAR(160) NOT NULL,
  description      TEXT         DEFAULT NULL,
  category         ENUM('workshop','cultural','sports','seminar','hackathon','other') NOT NULL DEFAULT 'other',
  starts_at        DATETIME     NOT NULL,
  ends_at          DATETIME     DEFAULT NULL,
  venue            VARCHAR(160) NOT NULL,
  cover_path       VARCHAR(255) DEFAULT NULL,
  registration_url VARCHAR(500) DEFAULT NULL,
  capacity         INT          DEFAULT NULL,
  going_count      INT          NOT NULL DEFAULT 0,
  interested_count INT          NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY events_starts_idx (starts_at),
  KEY events_category_idx (category, starts_at),
  CONSTRAINT events_organiser_fk FOREIGN KEY (organiser_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT events_end_after_start_chk CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT events_capacity_chk CHECK (capacity IS NULL OR capacity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id   INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  status     ENUM('going','interested') NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- One RSVP per person per event.
  PRIMARY KEY (event_id, user_id),
  KEY event_rsvps_user_idx (user_id, created_at),
  CONSTRAINT event_rsvps_event_fk FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT event_rsvps_user_fk  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Placements
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS jobs (
  id                INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  posted_by         INT UNSIGNED   NOT NULL,
  title             VARCHAR(120)   NOT NULL,
  company           VARCHAR(120)   NOT NULL,
  company_about     TEXT           DEFAULT NULL,
  description       TEXT           NOT NULL,
  type              ENUM('internship','full-time','part-time','freelance') NOT NULL,
  mode              ENUM('on-site','remote','hybrid') NOT NULL DEFAULT 'on-site',
  location          VARCHAR(120)   NOT NULL,
  openings          SMALLINT       NOT NULL DEFAULT 1,
  stipend_min       DECIMAL(12,2)  DEFAULT NULL,
  stipend_max       DECIMAL(12,2)  DEFAULT NULL,
  duration_months   SMALLINT       DEFAULT NULL,
  starts_on         DATE           DEFAULT NULL,
  apply_by          DATETIME       NOT NULL,
  apply_url         VARCHAR(500)   DEFAULT NULL,
  application_count INT            NOT NULL DEFAULT 0,
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY jobs_deadline_idx (apply_by),
  KEY jobs_filter_idx (type, mode, apply_by),
  KEY jobs_posted_by_idx (posted_by),
  CONSTRAINT jobs_posted_by_fk FOREIGN KEY (posted_by) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT jobs_openings_chk CHECK (openings >= 1),
  CONSTRAINT jobs_stipend_range_chk CHECK (stipend_min IS NULL OR stipend_max IS NULL OR stipend_max >= stipend_min)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_skills (
  id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id INT UNSIGNED NOT NULL,
  skill  VARCHAR(40)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY job_skills_unique (job_id, skill),
  KEY job_skills_lookup (skill),
  CONSTRAINT job_skills_job_fk FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_applications (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  job_id       INT UNSIGNED  NOT NULL,
  applicant_id INT UNSIGNED  NOT NULL,
  note         VARCHAR(1000) NOT NULL DEFAULT '',
  resume_url   VARCHAR(500)  DEFAULT NULL,
  status       ENUM('submitted','shortlisted','rejected') NOT NULL DEFAULT 'submitted',
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Nobody applies to the same posting twice.
  UNIQUE KEY job_applications_unique (job_id, applicant_id),
  KEY job_applications_applicant_idx (applicant_id, created_at),
  CONSTRAINT job_applications_job_fk       FOREIGN KEY (job_id)       REFERENCES jobs (id)  ON DELETE CASCADE,
  CONSTRAINT job_applications_applicant_fk FOREIGN KEY (applicant_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_bookmarks (
  user_id    INT UNSIGNED NOT NULL,
  job_id     INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, job_id),
  KEY job_bookmarks_recent_idx (user_id, created_at),
  CONSTRAINT job_bookmarks_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT job_bookmarks_job_fk  FOREIGN KEY (job_id)  REFERENCES jobs (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS listings (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  seller_id      INT UNSIGNED  NOT NULL,
  title          VARCHAR(100)  NOT NULL,
  description    VARCHAR(2000) NOT NULL DEFAULT '',
  category       ENUM('books','electronics','furniture','cycles','tickets','other') NOT NULL DEFAULT 'other',
  item_condition ENUM('new','like-new','used') NOT NULL DEFAULT 'used',
  -- DECIMAL, not FLOAT: money must not accumulate binary rounding error.
  price          DECIMAL(10,2) NOT NULL,
  contact        VARCHAR(120)  NOT NULL,
  status         ENUM('available','reserved','sold') NOT NULL DEFAULT 'available',
  like_count     INT           NOT NULL DEFAULT 0,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY listings_browse_idx (status, created_at),
  KEY listings_category_price_idx (category, price),
  KEY listings_seller_idx (seller_id),
  CONSTRAINT listings_seller_fk FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT listings_price_chk CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_images (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id INT UNSIGNED NOT NULL,
  path       VARCHAR(255) NOT NULL,
  position   SMALLINT     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY listing_images_listing_idx (listing_id, position),
  CONSTRAINT listing_images_listing_fk FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_likes (
  user_id    INT UNSIGNED NOT NULL,
  listing_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  KEY listing_likes_listing_idx (listing_id),
  CONSTRAINT listing_likes_user_fk    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
  CONSTRAINT listing_likes_listing_fk FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_bookmarks (
  user_id    INT UNSIGNED NOT NULL,
  listing_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  KEY listing_bookmarks_recent_idx (user_id, created_at),
  CONSTRAINT listing_bookmarks_user_fk    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
  CONSTRAINT listing_bookmarks_listing_fk FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS polls (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id   INT UNSIGNED NOT NULL,
  question    VARCHAR(200) NOT NULL,
  closes_at   DATETIME     DEFAULT NULL,
  total_votes INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY polls_created_idx (created_at),
  CONSTRAINT polls_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poll_options (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  poll_id    INT UNSIGNED NOT NULL,
  label      VARCHAR(80)  NOT NULL,
  vote_count INT          NOT NULL DEFAULT 0,
  position   SMALLINT     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY poll_options_poll_idx (poll_id, position),
  CONSTRAINT poll_options_poll_fk FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE,
  CONSTRAINT poll_options_vote_count_chk CHECK (vote_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  option_id  INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- One vote per person per poll; changing your mind updates option_id.
  PRIMARY KEY (poll_id, user_id),
  KEY poll_votes_option_idx (option_id),
  CONSTRAINT poll_votes_poll_fk   FOREIGN KEY (poll_id)   REFERENCES polls (id)        ON DELETE CASCADE,
  CONSTRAINT poll_votes_user_fk   FOREIGN KEY (user_id)   REFERENCES users (id)        ON DELETE CASCADE,
  CONSTRAINT poll_votes_option_fk FOREIGN KEY (option_id) REFERENCES poll_options (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Connections, notifications, feedback
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS connections (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id INT UNSIGNED NOT NULL,
  recipient_id INT UNSIGNED NOT NULL,
  status       ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMP    NULL DEFAULT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY connections_pair_unique (requester_id, recipient_id),
  KEY connections_inbox_idx (recipient_id, status),
  KEY connections_outbox_idx (requester_id, status),
  CONSTRAINT connections_requester_fk FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT connections_recipient_fk FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE,
  -- Nobody connects with themselves.
  CONSTRAINT connections_not_self_chk CHECK (requester_id <> recipient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_id INT UNSIGNED NOT NULL,
  -- Kept as NULL rather than cascading, so history survives an account deletion.
  actor_id     INT UNSIGNED DEFAULT NULL,
  type         ENUM('post_like','post_comment','blog_like','blog_comment',
                    'connection_request','connection_accepted','notice_posted','event_created') NOT NULL,
  message      VARCHAR(240) NOT NULL,
  link         VARCHAR(255) DEFAULT NULL,
  is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY notifications_inbox_idx (recipient_id, is_read, created_at),
  CONSTRAINT notifications_recipient_fk FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT notifications_actor_fk     FOREIGN KEY (actor_id)     REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED  NOT NULL,
  subject         VARCHAR(140)  NOT NULL,
  body            VARCHAR(3000) NOT NULL,
  category        ENUM('bug','suggestion','content','other') NOT NULL DEFAULT 'other',
  screenshot_path VARCHAR(255)  DEFAULT NULL,
  status          ENUM('open','in-review','resolved') NOT NULL DEFAULT 'open',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY feedback_triage_idx (status, created_at),
  CONSTRAINT feedback_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Study groups
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS study_groups (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  owner_id     INT UNSIGNED  NOT NULL,
  name         VARCHAR(80)   NOT NULL,
  description  VARCHAR(600)  NOT NULL DEFAULT '',
  category     ENUM('academic','coding','projects','creative','fitness','languages','other') NOT NULL DEFAULT 'other',
  -- Denormalised so a directory of groups is one query, not one per row.
  member_count INT           NOT NULL DEFAULT 0,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY study_groups_name_unique (name),
  KEY study_groups_browse_idx (category, member_count),
  CONSTRAINT study_groups_owner_fk FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT study_groups_member_count_chk CHECK (member_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_members (
  group_id   INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  role       ENUM('owner','member') NOT NULL DEFAULT 'member',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- One membership per person per group.
  PRIMARY KEY (group_id, user_id),
  KEY group_members_user_idx (user_id),
  CONSTRAINT group_members_group_fk FOREIGN KEY (group_id) REFERENCES study_groups (id) ON DELETE CASCADE,
  CONSTRAINT group_members_user_fk  FOREIGN KEY (user_id)  REFERENCES users (id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_discussions (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  group_id    INT UNSIGNED  NOT NULL,
  author_id   INT UNSIGNED  NOT NULL,
  body        VARCHAR(2000) NOT NULL,
  reply_count INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY group_discussions_group_idx (group_id, created_at),
  CONSTRAINT group_discussions_group_fk  FOREIGN KEY (group_id)  REFERENCES study_groups (id) ON DELETE CASCADE,
  CONSTRAINT group_discussions_author_fk FOREIGN KEY (author_id) REFERENCES users (id)        ON DELETE CASCADE,
  CONSTRAINT group_discussions_reply_count_chk CHECK (reply_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_replies (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  discussion_id INT UNSIGNED  NOT NULL,
  author_id     INT UNSIGNED  NOT NULL,
  body          VARCHAR(1000) NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY group_replies_discussion_idx (discussion_id, created_at),
  CONSTRAINT group_replies_discussion_fk FOREIGN KEY (discussion_id) REFERENCES group_discussions (id) ON DELETE CASCADE,
  CONSTRAINT group_replies_author_fk     FOREIGN KEY (author_id)     REFERENCES users (id)             ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
