from django.contrib import admin
from .models import Message

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['sender', 'content', 'timestamp', 'is_read', 'read_at']
    list_filter = ['sender', 'is_read', 'timestamp']
