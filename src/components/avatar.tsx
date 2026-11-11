export function Avatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-8 w-8 text-sm", md: "h-10 w-10 text-base", lg: "h-14 w-14 text-xl" };
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${sizes[size]}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
