import { elevation } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Language A's hard offset shadow, made cross-platform.
 *
 * `elevation.brand` carries the geometry, but React Native only renders
 * `shadowOffset` / `shadowRadius` / `shadowOpacity` on iOS and web — on Android
 * the view shadow comes from `elevation` (0 here, on purpose: the brand never
 * uses a soft shadow) or from `boxShadow`. So the same geometry is mirrored into
 * `boxShadow`, which RN 0.86 renders on all three platforms. The offsets stay
 * derived from the token, so nothing drifts if the token changes.
 */
function withHardShadow(token: {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
}) {
  const { width, height } = token.shadowOffset;
  return { ...token, boxShadow: `${width}px ${height}px 0px 0px ${token.shadowColor}` };
}

export const brandElevation = {
  brand: withHardShadow(elevation.brand),
  brandSmall: withHardShadow(elevation.brandSmall),
  /** The same geometry on the dark brand ground (shadow goes to true black). */
  brandDark: withHardShadow(elevation.brandDark),
  brandDarkSmall: withHardShadow(elevation.brandDarkSmall),
};

/**
 * Picks Language A's hard shadow for the active theme.
 *
 *   const shadow = useBrandElevation();
 *   <View style={[styles.card, shadow.brand]} />
 *
 * The geometry is identical in both themes; only the shadow colour moves, so a
 * card cannot drift between light and dark.
 */
export function useBrandElevation() {
  const { isDark } = useTheme();
  return isDark
    ? { brand: brandElevation.brandDark, brandSmall: brandElevation.brandDarkSmall }
    : { brand: brandElevation.brand, brandSmall: brandElevation.brandSmall };
}
