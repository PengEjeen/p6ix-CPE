from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        exclude = ['password']
        read_only_fields = [
            'id',
            'username',      # 로그인 ID는 수정 불가
            'email',         # 이메일 수정 막기
            'role',          # 권한 수정 막기
            'is_active',
            'is_staff',
            'is_superuser',
            'last_login',
            'date_joined',
            'groups',
            'user_permissions',
        ]

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'company', 'department', 'position']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # 커스텀 payload
        token['username'] = user.username
        token['role'] = user.role
        token['company'] = user.company
        return token

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("현재 비밀번호가 일치하지 않습니다.")
        return value

    def validate(self, data):
        if data['old_password'] == data['new_password']:
            raise serializers.ValidationError({"new_password": "새 비밀번호는 현재 비밀번호와 다르게 설정해야 합니다."})
        return data
