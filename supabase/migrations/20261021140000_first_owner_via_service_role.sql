-- İlk owner artık sadece servis anahtarıyla (pnpm owner:create) veya SQL ile oluşturulur.
--
-- Önceki politika, team_members boşken oturum açan HERHANGİ bir kullanıcının kendini
-- owner olarak eklemesine izin veriyordu. Hosted projede kayıt yanlışlıkla açık kalırsa
-- ilk gelen yabancı çalışma alanının sahibi olabiliyordu; iki kişi aynı anda girerse
-- ikisi de owner olabiliyordu (yarış durumu).
--
-- is_initial_owner_setup() fonksiyonu tip üretimini bozmamak için şimdilik duruyor,
-- ama hiçbir politika veya uygulama kodu artık onu kullanmıyor.

DROP POLICY team_members_insert ON public.team_members;
CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team());

COMMENT ON FUNCTION public.is_initial_owner_setup() IS
  'Kullanımdan kalktı: ilk owner pnpm owner:create ile oluşturulur. Bir sonraki tip üretiminde kaldırılacak.';
