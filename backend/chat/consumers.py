import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import Message, UserStatus

user_connections = {}

# Server restartda hammani offlayn qilish
try:
    UserStatus.objects.all().update(is_online=False)
except:
    pass

def log_debug(msg):
    try:
        import os
        from django.conf import settings
        log_path = os.path.join(settings.BASE_DIR, 'chat_debug.log')
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"[{timezone.now().isoformat()}] {msg}\n")
    except Exception as e:
        print(f"Log error: {e}")

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'chat_room'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        log_debug(f"Socket CONNECTED: channel={self.channel_name}")

    async def disconnect(self, close_code):
        log_debug(f"Socket DISCONNECT: channel={self.channel_name}, code={close_code}")
        try:
            if hasattr(self, 'user_name'):
                log_debug(f"Disconnecting user: {self.user_name}")
                if self.user_name in user_connections:
                    user_connections[self.user_name].discard(self.channel_name)
                    remaining = len(user_connections[self.user_name])
                    log_debug(f"Remaining connections for {self.user_name}: {remaining}")
                    if remaining <= 0:
                        await self.update_user_status(self.user_name, False)
                        log_debug(f"User {self.user_name} marked as OFFLINE")
                await self.send_online_count()
            else:
                log_debug("No user_name on this socket connection")
        except Exception as e:
            log_debug(f"ERROR in disconnect: {e}")

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type', 'message')
        
        if message_type == 'user_join':
            self.user_name = data['username']
            log_debug(f"Socket JOIN: user={self.user_name}, channel={self.channel_name}")
            if self.user_name not in user_connections:
                user_connections[self.user_name] = set()
            user_connections[self.user_name].add(self.channel_name)
            log_debug(f"Active connections for {self.user_name}: {len(user_connections[self.user_name])}")
            await self.update_user_status(self.user_name, True)
            await self.send_online_count()

        elif message_type == 'ping':
            username = data.get('username')
            if username:
                await self.update_user_status(username, True)

        elif message_type == 'status_change':
            username = data.get('username')
            is_online = data.get('is_online', False)
            if username:
                await self.update_user_status(username, is_online)
                await self.send_online_count()

        elif message_type == 'typing':
            # Kim yozayotganini barcha guruhga tarqatamiz
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_typing',
                    'username': data['username'],
                    'is_typing': data['is_typing']
                }
            )

        elif message_type == 'read_receipt':
            sender = data['sender']
            await self.mark_messages_read(sender)
            await self.channel_layer.group_send(self.room_group_name, { 'type': 'read_update', 'reader': sender })

        elif message_type == 'edit_message':
            message_id = data['message_id']
            new_content = data['message']
            msg = await self.edit_message_db(message_id, new_content)
            if msg:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'message_edited',
                        'message_id': message_id,
                        'message': new_content,
                        'timestamp': timezone.localtime(msg.timestamp).strftime('%H:%M'),
                    }
                )
        elif message_type == 'delete_message':
            message_id = data['message_id']
            success = await self.delete_message_db(message_id)
            if success:
                await self.channel_layer.group_send(self.room_group_name, { 'type': 'message_deleted', 'message_id': message_id })
        elif message_type == 'clear_chat':
            await self.clear_all_messages_db()
            await self.channel_layer.group_send(self.room_group_name, { 'type': 'messages_cleared' })
        else:
            sender = data['sender']
            message = data.get('message', '')
            reply_to_id = data.get('reply_to_id')
            msg_id = data.get('message_id')
            
            if msg_id:
                msg = await self.get_message_db(msg_id)
            else:
                msg = await self.save_message(sender, message, reply_to_id)
            
            reply_data = None
            if msg.reply_to:
                reply_data = {
                    'id': msg.reply_to.id,
                    'sender': msg.reply_to.sender,
                    'content': msg.reply_to.content[:50]
                }
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'sender': sender,
                    'message': msg.content,
                    'message_id': msg.id,
                    'timestamp': timezone.localtime(msg.timestamp).strftime('%H:%M'),
                    'is_read': msg.is_read,
                    'reply_to': reply_data,
                    'image_url': msg.image.url if msg.image else None
                }
            )

    async def user_typing(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'username': event['username'],
            'is_typing': event['is_typing']
        }))

    async def send_online_count(self):
        status_data = await self.get_all_user_statuses()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status_update',
                'online_users': status_data['online_users'],
                'last_seen': status_data['last_seen']
            }
        )

    async def user_status_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'online_users': event['online_users'],
            'last_seen': event['last_seen']
        }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'sender': event['sender'],
            'message': event['message'],
            'message_id': event['message_id'],
            'timestamp': event['timestamp'],
            'is_read': event['is_read'],
            'reply_to': event.get('reply_to'),
            'image_url': event.get('image_url')
        }))
    
    async def message_edited(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_edited',
            'message_id': event['message_id'],
            'message': event['message'],
            'timestamp': event['timestamp']
        }))
    async def message_deleted(self, event):
        await self.send(text_data=json.dumps({ 'type': 'message_deleted', 'message_id': event['message_id'] }))
    async def messages_cleared(self, event):
        await self.send(text_data=json.dumps({ 'type': 'messages_cleared' }))
    async def read_update(self, event):
        await self.send(text_data=json.dumps({ 'type': 'read_update', 'reader': event['reader'] }))
    
    @database_sync_to_async
    def update_user_status(self, username, is_online):
        now = timezone.now()
        try:
            status = UserStatus.objects.get(username=username)
            # DB yukini kamaytirish: status o'zgarmagan bo'lsa va 15 soniya ichida yangilangan bo'lsa yozishni o'tkazib yuboramiz
            if status.is_online == is_online and (now - status.last_seen).total_seconds() < 15:
                return
            status.is_online = is_online
            status.last_seen = now
            status.save(update_fields=['is_online', 'last_seen'])
        except UserStatus.DoesNotExist:
            UserStatus.objects.create(username=username, is_online=is_online, last_seen=now)

    @database_sync_to_async
    def get_all_user_statuses(self):
        users = UserStatus.objects.all()
        threshold = timezone.now() - timezone.timedelta(seconds=20)
        online_users = [u.username for u in users if u.is_online and u.last_seen >= threshold]
        last_seen = {u.username: timezone.localtime(u.last_seen).isoformat() for u in users}
        return {'online_users': online_users, 'last_seen': last_seen}

    @database_sync_to_async
    def save_message(self, sender, content, reply_to_id=None):
        reply_to = None
        if reply_to_id:
            try:
                reply_to = Message.objects.get(id=reply_to_id)
            except Message.DoesNotExist:
                pass
        message = Message.objects.create(sender=sender, content=content, reply_to=reply_to)
        return message

    @database_sync_to_async
    def get_message_db(self, msg_id):
        return Message.objects.get(id=msg_id)

    @database_sync_to_async
    def edit_message_db(self, message_id, content):
        try:
            message = Message.objects.get(id=message_id)
            message.content = content
            message.is_edited = True
            message.edited_at = timezone.now()
            message.save()
            return message
        except Message.DoesNotExist:
            return None
    @database_sync_to_async
    def delete_message_db(self, message_id):
        try:
            Message.objects.filter(id=message_id).delete()
            return True
        except Exception:
            return False
    
    @database_sync_to_async
    def clear_all_messages_db(self):
        Message.objects.all().delete()

    @database_sync_to_async
    def mark_messages_read(self, reader):
        Message.objects.filter(is_read=False).exclude(sender=reader).update(
            is_read=True,
            read_at=timezone.now()
        )
