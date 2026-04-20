export class Task {
  constructor({ id, title, description = "", priority = "medium", deadline = null, category = "General", status = "pending", createdAt = new Date().toISOString(), completedAt = null, recurring = false, recurringInterval = null, tags = [] }) {
    this.id = id || crypto.randomUUID();
    this.title = title;
    this.description = description;
    this.priority = priority; // critical | high | medium | low
    this.deadline = deadline;
    this.category = category;
    this.status = status; // pending | in-progress | completed | overdue
    this.createdAt = createdAt;
    this.completedAt = completedAt;
    this.recurring = recurring;
    this.recurringInterval = recurringInterval; // minutes
    this.tags = tags;
  }
  isOverdue() {
    if (!this.deadline || this.status === "completed") return false;
    return new Date(this.deadline) < new Date();
  }
  getUrgencyScore() {
    if (!this.deadline) return 0;
    const now = new Date();
    const dl = new Date(this.deadline);
    const hoursLeft = (dl - now) / 36e5;
    const priorityWeight = { critical: 100, high: 70, medium: 40, low: 10 }[this.priority] || 40;
    if (hoursLeft < 0) return priorityWeight + 200;
    if (hoursLeft < 1) return priorityWeight + 150;
    if (hoursLeft < 24) return priorityWeight + 80;
    if (hoursLeft < 72) return priorityWeight + 40;
    return priorityWeight;
  }
  toJSON() {
    return { ...this };
  }
}
