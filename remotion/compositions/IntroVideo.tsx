import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const IntroVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pastel rainbow gradient background (matching the app)
  const background = 'linear-gradient(135deg, #E5B5C4 0%, #E5C5A8 14%, #E8DDB0 28%, #C8DDB8 42%, #B5D5DB 56%, #B5C0D9 70%, #D4C4D9 84%, #E5C4D4 100%)';

  // Animation timings (at 30fps)
  // 0-30 frames (0-1s): Fade in logo
  // 30-90 frames (1-3s): Show first line "Say the sound..."
  // 90-150 frames (3-5s): Show second line "and learn to read!"
  // 150-180 frames (5-6s): Show third line "Every letter becomes..."
  // 180-210 frames (6-7s): Show CTA "Tap to start learning!"
  // 210-240 frames (7-8s): Fade out to white

  // Logo animation (fade in + scale)
  const logoOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({
    frame: frame,
    fps,
    from: 0.5,
    to: 1,
    config: { damping: 15 }
  });

  // Text animations - each line fades in and slightly moves up
  const line1Opacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const line1Y = interpolate(frame, [30, 45], [20, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const line2Opacity = interpolate(frame, [90, 105], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const line2Y = interpolate(frame, [90, 105], [20, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const line3Opacity = interpolate(frame, [150, 165], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const line3Y = interpolate(frame, [150, 165], [20, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const ctaOpacity = interpolate(frame, [180, 195], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const ctaScale = spring({
    frame: frame - 180,
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 12 }
  });

  // Final fade to white
  const fadeOut = interpolate(frame, [210, 240], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill>
      {/* Background */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '60px',
          position: 'relative'
        }}
      >
        {/* Audio */}
        <Audio src="/audio/intro-vo-1-kid-focused.mp3" />

        {/* Logo / App Name */}
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            marginBottom: '80px'
          }}
        >
          <h1
            style={{
              fontSize: '120px',
              fontWeight: 900,
              color: 'white',
              margin: 0,
              textShadow: '0 8px 32px rgba(0,0,0,0.3)',
              letterSpacing: '-2px'
            }}
          >
            Wunderkind
          </h1>
        </div>

        {/* Animated text lines */}
        <div
          style={{
            maxWidth: '900px',
            textAlign: 'center'
          }}
        >
          {/* Line 1: "Say the sound..." */}
          <p
            style={{
              fontSize: '56px',
              fontWeight: 600,
              color: 'white',
              opacity: line1Opacity,
              transform: `translateY(${line1Y}px)`,
              margin: '0 0 30px 0',
              textShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}
          >
            Say the sound...
          </p>

          {/* Line 2: "and learn to read!" */}
          <p
            style={{
              fontSize: '56px',
              fontWeight: 600,
              color: 'white',
              opacity: line2Opacity,
              transform: `translateY(${line2Y}px)`,
              margin: '0 0 30px 0',
              textShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}
          >
            and learn to read!
          </p>

          {/* Line 3: "Every letter becomes..." */}
          <p
            style={{
              fontSize: '48px',
              fontWeight: 500,
              color: 'white',
              opacity: line3Opacity,
              transform: `translateY(${line3Y}px)`,
              margin: '0 0 50px 0',
              textShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}
          >
            Every letter becomes a fun voice game.
          </p>

          {/* CTA: "Tap to start learning!" */}
          <div
            style={{
              opacity: ctaOpacity,
              transform: `scale(${frame >= 180 ? ctaScale : 1})`
            }}
          >
            <div
              style={{
                display: 'inline-block',
                padding: '24px 48px',
                background: 'rgba(255, 255, 255, 0.3)',
                border: '3px solid rgba(255, 255, 255, 0.6)',
                borderRadius: '60px',
                fontSize: '44px',
                fontWeight: 700,
                color: 'white',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(10px)'
              }}
            >
              Tap to start learning!
            </div>
          </div>
        </div>
      </div>

      {/* Fade to white overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'white',
          opacity: fadeOut,
          pointerEvents: 'none'
        }}
      />
    </AbsoluteFill>
  );
};
