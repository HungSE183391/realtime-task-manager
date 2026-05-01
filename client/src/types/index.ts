export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  createdAt?: string;
}

export interface AdminUser extends User {
  role: UserRole;
  createdAt: string;
  _count: {
    ownedBoards: number;
    memberships: number;
    assignedTasks: number;
  };
}

export interface AdminBoard {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  owner: User;
  _count: { members: number; columns: number };
}

export interface AdminStats {
  users: number;
  admins: number;
  boards: number;
  tasks: number;
  comments: number;
  attachments: number;
}

export type Role = 'OWNER' | 'MEMBER';

export interface BoardSummary {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  role: Role;
  _count?: { members: number; columns: number };
}

export interface BoardMember {
  id: string;
  boardId: string;
  userId: string;
  role: Role;
  user: User;
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  completed: boolean;
  assignedToId: string | null;
  assignedTo: User | null;
  dueDate: string | null;
  createdAt: string;
  _count?: { comments: number; attachments: number };
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: User;
}

export interface Attachment {
  id: string;
  taskId: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  user: User;
}

export interface Column {
  id: string;
  boardId: string;
  title: string;
  position: number;
  tasks: Task[];
}

export interface BoardDetail {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  owner: User;
  members: BoardMember[];
  columns: Column[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Message {
  id: string;
  boardId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: User;
}

export interface DirectMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  fromUser: User;
  toUser: User;
}

export interface DMConversation {
  otherUser: User;
  latestMessage: DirectMessage;
  unreadCount: number;
}
