/** Ola curva del borde inferior de los headers con degradado. */
export default function HeaderWave() {
  return (
    <div
      aria-hidden
      className="absolute left-0 right-0"
      style={{
        bottom: -2,
        height: 28,
        background: "var(--bg)",
        borderRadius: "50% 50% 0 0 / 24px 24px 0 0",
      }}
    />
  );
}
