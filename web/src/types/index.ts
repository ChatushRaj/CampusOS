export type Role = 'student' | 'faculty' | 'admin';

export interface UserSummary {
  id: number;
  name: string;
  role: Role;
  headline: string;
  department: string | null;
  graduationYear: number | null;
  avatarUrl: string | null;
}

export interface CurrentUser extends UserSummary {
  email: string;
  rollNumber: string | null;
  bio: string;
  interests: string[];
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Post {
  id: number;
  body: string;
  images: string[];
  tags: string[];
  visibility: 'campus' | 'connections';
  likeCount: number;
  commentCount: number;
  author: UserSummary;
  isLiked: boolean;
  isBookmarked: boolean;
  isMine: boolean;
  createdAt: string;
}

export interface Blog {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body?: string;
  coverUrl: string | null;
  tags: string[];
  readMinutes: number;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  author: UserSummary;
  isLiked: boolean;
  isBookmarked: boolean;
  isMine: boolean;
  createdAt: string;
}

export interface Comment {
  id: number;
  body: string;
  author: UserSummary;
  isMine: boolean;
  createdAt: string;
}

export interface Notice {
  id: number;
  title: string;
  body: string;
  category: 'academic' | 'examination' | 'placement' | 'facility' | 'general';
  priority: 'normal' | 'important' | 'urgent';
  attachmentUrl: string | null;
  expiresAt: string | null;
  pinned: boolean;
  postedBy: UserSummary;
  canManage: boolean;
  createdAt: string;
}

export interface CampusEvent {
  id: number;
  title: string;
  description: string;
  category: 'workshop' | 'cultural' | 'sports' | 'seminar' | 'hackathon' | 'other';
  startsAt: string;
  endsAt: string | null;
  venue: string;
  coverUrl: string | null;
  registrationUrl: string | null;
  capacity: number | null;
  goingCount: number;
  interestedCount: number;
  organiser: UserSummary;
  myRsvp: 'going' | 'interested' | null;
  canManage: boolean;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  companyAbout: string;
  description: string;
  type: 'internship' | 'full-time' | 'part-time' | 'freelance';
  mode: 'on-site' | 'remote' | 'hybrid';
  location: string;
  skills: string[];
  openings: number;
  stipendMin: number | null;
  stipendMax: number | null;
  durationMonths: number | null;
  startsOn: string | null;
  applyBy: string;
  applyUrl: string | null;
  applicationCount: number;
  postedBy: UserSummary;
  isBookmarked: boolean;
  hasApplied: boolean;
  isExpired: boolean;
  canManage: boolean;
  createdAt: string;
}

export interface Listing {
  id: number;
  title: string;
  description: string;
  category: 'books' | 'electronics' | 'furniture' | 'cycles' | 'tickets' | 'other';
  condition: 'new' | 'like-new' | 'used';
  price: number;
  images: string[];
  contact: string;
  status: 'available' | 'reserved' | 'sold';
  likeCount: number;
  seller: UserSummary;
  isLiked: boolean;
  isBookmarked: boolean;
  canManage: boolean;
  createdAt: string;
}

export interface Poll {
  id: number;
  question: string;
  options: { id: number; label: string; voteCount: number; percentage: number }[];
  totalVotes: number;
  closesAt: string | null;
  isClosed: boolean;
  myVote: number | null;
  author: UserSummary;
  canManage: boolean;
  createdAt: string;
}

export interface PersonRow extends UserSummary {
  connection: { id: number; status: 'pending' | 'accepted'; direction: 'outgoing' | 'incoming' } | null;
}

export interface AppNotification {
  id: number;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  actor: UserSummary | null;
  createdAt: string;
}

export interface BookmarkRow {
  id: number;
  type: 'post' | 'blog' | 'job' | 'listing';
  title: string;
  subtitle: string;
  images: string[];
  author: UserSummary | null;
  href: string;
  savedAt: string;
}

export interface DashboardStat {
  key: string;
  label: string;
  value: number;
  hint?: string;
}

export interface DashboardData {
  role: Role;
  stats: DashboardStat[];
  charts?: {
    signups?: { date: string; count: number }[];
    posts?: { date: string; count: number }[];
    applications?: { date: string; count: number }[];
    departments?: { label: string; count: number }[];
  };
  upcomingEvents: {
    id: number;
    title: string;
    startsAt: string;
    venue: string;
    category: string;
    coverUrl: string | null;
  }[];
  latestNotices: {
    id: number;
    title: string;
    priority: string;
    category: string;
    postedBy: UserSummary;
    createdAt: string;
  }[];
  myEvents?: { id: number; title: string; startsAt: string; venue: string }[];
  myJobs?: { id: number; title: string; company: string; applyBy: string; applicationCount: number }[];
}
