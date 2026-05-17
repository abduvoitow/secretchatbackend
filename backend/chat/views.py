import json
import os
from django.http import JsonResponse, HttpResponse, Http404
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.conf import settings
from .models import Message, UserStatus

@csrf_exempt
def api_login(request):
    """React uchun login API - Maxfiy kodlar bilan"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            code = data.get('code')
            
            # Kodlarni foydalanuvchilarga bog'lash
            user_map = {
                '3301': 'D',    # Qiz bolaga
                '090156': 'K',  # Yigit kishiga
            }
            
            if code in user_map:
                user = user_map[code]
                request.session['user'] = user
                # UserStatus ni yangilash yoki yaratish
                UserStatus.objects.get_or_create(username=user)
                return JsonResponse({'success': True, 'user': user})
            else:
                return JsonResponse({
                    'success': False, 
                    'error': 'Konferensiya ID raqami noto\'g\'ri kiritildi.'
                }, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Invalid method'}, status=405)

def api_check_auth(request):
    """Sessiya holatini tekshirish"""
    if 'user' in request.session:
        return JsonResponse({'logged_in': True, 'user': request.session['user']})
    return JsonResponse({'logged_in': False})

def get_new_messages(request):
    """React uchun barcha xabarlarni olish"""
    if 'user' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    messages = Message.objects.all().order_by('timestamp')
    
    # Oxirgi faolliklarni ham yuboramiz
    threshold = timezone.now() - timezone.timedelta(seconds=20)
    last_seen_data = {us.username: timezone.localtime(us.last_seen).isoformat() for us in UserStatus.objects.all()}
    online_users = list(UserStatus.objects.filter(is_online=True, last_seen__gte=threshold).values_list('username', flat=True))

    data = {
        'messages': [
            {
                'id': msg.id,
                'sender': msg.sender,
                'content': msg.content,
                'timestamp': timezone.localtime(msg.timestamp).strftime('%H:%M'),
                'is_read': msg.is_read,
                'is_edited': msg.is_edited,
                'image_url': msg.image.url if msg.image else None,
                'reply_to': {
                    'id': msg.reply_to.id,
                    'sender': msg.reply_to.sender,
                    'content': msg.reply_to.content[:50]
                } if msg.reply_to else None
            }
            for msg in messages
        ],
        'online_users': online_users,
        'last_seen': last_seen_data
    }
    return JsonResponse(data)

@csrf_exempt
def api_upload_image(request):
    """React uchun rasm yuklash API"""
    if 'user' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    if request.method == 'POST' and request.FILES.get('image'):
        try:
            image_file = request.FILES['image']
            msg = Message.objects.create(
                sender=request.session['user'],
                content="[Rasm]",
                image=image_file
            )
            return JsonResponse({
                'success': True,
                'image_url': msg.image.url,
                'message_id': msg.id
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)

def logout_view(request):
    """Chiqish"""
    if 'user' in request.session:
        user = request.session['user']
        UserStatus.objects.filter(username=user).update(is_online=False, last_seen=timezone.now())
        del request.session['user']
    return redirect('/')
