#! /bin/bash

# Check for .crt files in the certs directory
shopt -s nullglob && CERTS=($SSL/*.crt)
if [[ $CERTS ]]; then
  CERT_FILE=$SSL/tls.yml
  echo -e "tls:\n  certificates:" > $CERT_FILE

  # Add each certificate and its corresponding key to the TLS configuration
  for cert in ${CERTS[@]}; do
    key="${cert%.crt}.key"; if [[ -f $key ]]; then
      echo "    - certFile: /$cert" >> $CERT_FILE
      echo "      keyFile: /$key" >> $CERT_FILE
    else
      echo "⚠️  No $key file found in the $SSL directory. Please add your private key before proceeding. Script stopped."
      exit 1
    fi
  done
  echo "✅ Traefik TLS configuration generated at $CERT_FILE"
