from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests
import os

User = get_user_model()


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        id_token_str = request.data.get('id_token')
        
        if not id_token_str:
            return Response(
                {'error': 'id_token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Google ID Token 검증 (clock skew tolerance 추가)
            client_id = os.environ.get('GOOGLE_CLIENT_ID')
            idinfo = id_token.verify_oauth2_token(
                id_token_str,
                requests.Request(),
                client_id,
                clock_skew_in_seconds=10  # 시간 차이 허용
            )

            # 이메일 정보 추출
            email = idinfo.get('email')
            email_verified = idinfo.get('email_verified', False)
            name = idinfo.get('name', '')
            
            if not email or not email_verified:
                return Response(
                    {'error': 'Email not verified by Google'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 사용자 조회 또는 생성
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email.split('@')[0],
                    'first_name': name.split()[0] if name else '',
                    'last_name': ' '.join(name.split()[1:]) if len(name.split()) > 1 else '',
                    'login_provider': 'google',
                    'is_active': True,
                }
            )

            # 기존 사용자인 경우 login_provider 업데이트
            if not created and user.login_provider != 'google':
                # 이미 로컬 계정이 있는 경우 연동 처리
                user.login_provider = 'google'
                user.save()

            # JWT 토큰 발급
            refresh = RefreshToken.for_user(user)
            
            # 커스텀 클레임 추가
            refresh['username'] = user.username
            refresh['role'] = user.role
            refresh['company'] = user.company

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': str(user.id),
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'company': user.company,
                    'department': user.department,
                    'position': user.position,
                    'role': user.role,
                    'login_provider': user.login_provider,
                }
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            # 토큰 검증 실패
            return Response(
                {'error': f'Invalid token: {str(e)}'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            return Response(
                {'error': f'Authentication failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GoogleClientIdView(APIView):
    """
    프론트엔드에서 GOOGLE_CLIENT_ID를 가져오기 위한 API
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        client_id = os.environ.get('GOOGLE_CLIENT_ID', '')
        return Response({'client_id': client_id})
