from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status, permissions, views, generics
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer, ChangePasswordSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        print("[DEBUG] 요청 사용자:", self.request.user)
        print("[DEBUG] 요청 메서드:", self.request.method)
        return self.request.user

    def update(self, request, *args, **kwargs):
        print("[DEBUG] 요청 데이터:", request.data)
        response = super().update(request, *args, **kwargs)
        print("[DEBUG] 응답 데이터:", response.data)
        return response

    def handle_exception(self, exc):
        from rest_framework.response import Response
        from rest_framework import status
        import traceback

        print("[ERROR] 예외 발생:", exc)
        traceback.print_exc()

        if hasattr(exc, "detail"):
            print("[ERROR DETAIL]", exc.detail)
        return super().handle_exception(exc)


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response(status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordView(generics.UpdateAPIView):
    """
    비밀번호 변경 API
    """
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        self.object = self.get_object()
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            # Set new password
            self.object.set_password(serializer.data.get("new_password"))
            self.object.save()
            
            response = {
                'status': 'success',
                'code': status.HTTP_200_OK,
                'message': '비밀번호가 성공적으로 변경되었습니다.'
            }

            return Response(response)

        print("[Password Change Error]", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
