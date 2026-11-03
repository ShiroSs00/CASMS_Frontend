import { Link, type LinkProps } from 'react-router'
// Public navigation has no dependency on staff roles or internal route policy.
export function PermissionLink({ hideWhenDenied, ...props }: LinkProps & { hideWhenDenied?: boolean }) {
  void hideWhenDenied
  return <Link {...props} />
}
