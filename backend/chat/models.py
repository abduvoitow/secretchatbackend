from django.db import models
from django.utils import timezone

class Message(models.Model):
    """Xabarlar - K yoki D tomonidan"""
    sender = models.CharField(max_length=50)
    content = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    image = models.ImageField(upload_to='chat_images/', null=True, blank=True)
    
    class Meta:
        ordering = ['timestamp']

class UserStatus(models.Model):
    username = models.CharField(max_length=50, unique=True)
    last_seen = models.DateTimeField(default=timezone.now)
    is_online = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} - {self.last_seen}"
