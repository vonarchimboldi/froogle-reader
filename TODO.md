# TODO

- Harden admin analytics privacy:
  - Store admin roles in the database instead of relying only on `ADMIN_EMAILS`.
  - Mask user emails by default in the analytics UI, with an explicit reveal action if needed.
  - Keep aggregate product analytics separate from user/account administration.
  - Audit admin analytics access.
  - Remove unnecessary sensitive fields from analytics responses.
