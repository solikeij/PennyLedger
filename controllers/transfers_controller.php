<?php
require_auth($conn);
send_error('Wallet balances and transfers are no longer supported', 410);
