import os
import boto3
import json
from botocore.exceptions import ClientError
from botocore.config import Config

# Configuration for MinIO
S3_INTERNAL_ENDPOINT = os.getenv("S3_ENDPOINT", "http://minio:9000")
S3_EXTERNAL_ENDPOINT = os.getenv("NEXT_PUBLIC_S3_ENDPOINT", "http://localhost:9000")

S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
BUCKET_NAME = "incident-attachments"

# Initialize S3 client for MinIO
def get_s3_client():
  return boto3.client(
    "s3",
    endpoint_url=S3_INTERNAL_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version='s3v4')
  )

# Function that creates a presigned URL for uploading an attachment
def create_presigned_post(object_name: str, expiration: int = 3600):
  """
  Generate a Presigned URL that allows the frontend to upload directly to S3/MinIO.
  """
  s3_client = get_s3_client()
  try:
    # Ensure the bucket exists
    try:
      s3_client.head_bucket(Bucket=BUCKET_NAME)
    except ClientError:
      s3_client.create_bucket(Bucket=BUCKET_NAME)
      
      # Set Policy to public-read so users can view images later without signing every GET request
      policy = {
        "Version": "2012-10-17",
        "Statement": [{
          "Sid": "PublicRead",
          "Effect": "Allow",
          "Principal": "*",
          "Action": ["s3:GetObject"],
          "Resource": [f"arn:aws:s3:::{BUCKET_NAME}/*"]
        }]
      }
      s3_client.put_bucket_policy(Bucket=BUCKET_NAME, Policy=json.dumps(policy))
      
    # Generate the presigned URL
    response = s3_client.generate_presigned_post(
      Bucket=BUCKET_NAME,
      Key=object_name,
      Fields={"acl": "public-read"}, # Optional: set ACL to public-read
      Conditions=[
        {"acl": "public-read"},
        ["content-length-range", 0, 10485760] # Max 10MB
      ],
      ExpiresIn=expiration
    )
    # Modify the URL to use the external endpoint for frontend access
    if "minio:9000" in response["url"]:
      response["url"] = response["url"].replace("minio:9000", "localhost:9000")
  except ClientError as e:
    print(f"Error generating presigned URL: {e}")
    return None
  return response