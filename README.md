# drone-cfn-security-group
[![Build Status](https://travis-ci.org/robertstettner/drone-cfn-security-group.svg?branch=master)](https://travis-ci.org/robertstettner/drone-cfn-security-group)
[![Coverage Status](https://coveralls.io/repos/github/robertstettner/drone-cfn-security-group/badge.svg?branch=master)](https://coveralls.io/github/robertstettner/drone-cfn-security-group?branch=master)

Drone plugin for creating complex AWS CloudFormation Security Groups. 

It will create a matrix of rules, Ingress/Egress ports over CIDRs and 
export the security group that is created so it could be used in another 
CloudFormation stack.

## Configuration

The following parameters are used to configure the plugin:

- `exportname`: the name of the CloudFormation stack and export. Required.
- `vpcid`: the VPC Id to associate the Security Group to. 
  This can be a exported value, in CloudFormation eg. `!ImportValue MyAppVpcId`. Required.
- `description`: the description of the CloudFormation stack. Required.
- `ingress_cidrs`: ingress CIDR ranges. Optional.
- `ingress_ports`: array of ingress ports as numbers or objects with 
  parameters (`from_port`, `to_port`, `protocol`). Optional.
- `egress_cidrs`: egress CIDR ranges. Optional.
- `egress_ports`: array of ingress ports as numbers or objects with 
  parameters (`from_port`, `to_port`, `protocol`). Optional.
- `region`: the AWS region to deploy to. Defaults to `eu-west-1`.
- `access_key`: the AWS access key. Optional.
- `secret_key`: the AWS secret key. Optional.

### Drone configuration example

Simple example below:
```yaml
pipeline:
  ...
  security:
    image: robertstettner/drone-cfn-security-group
    pull: true
    exportname: MyApplicationSecurityGroup
    ingress_cidrs:
      - 54.123.32.123/32
      - 67.2.34.3/32
      - 5.231.12.0/24
      - 77.65.0.0/16
    ingress_ports:
      - 80 # HTTP all protocols
      - 433 # HTTPS all protocols
      - 22 # SSH all protocols
    when:
      event: deployment
```

You could then use the security group in other stacks by referring to it using in the syntax for JSON CloudFormation templates:
```json
{ "Fn::ImportValue" : "MyApplicationSecurityGroup" }
```

or for YAML CloudFormation templates:
```yaml
!ImportValue MyApplicationSecurityGroup
```

Complex example below:
```yaml
pipeline:
  ...
  security:
    image: robertstettner/drone-cfn-security-group
    pull: true
    exportname: MyApplicationSecurityGroup
    ingress_cidrs:
      - 54.123.32.123/32
      - 67.2.34.3/32
      - 5.231.12.0/24
      - 77.65.0.0/16
    ingress_ports:
      - from_port: 80
        to_port: 82
        protocol: tcp
      - from_port: 433
        to_port: 433
        protocol: tcp
      - from_port: 115
        to_port: 115
        protocol: udp
    egress_cidrs:
      - 54.123.32.123/32
      - 67.2.34.3/32
      - 5.231.12.0/24
      - 77.65.0.0/16
    egress_ports:
      - from_port: 80
        to_port: 82
        protocol: tcp
      - from_port: 433
        to_port: 433
        protocol: tcp
      - from_port: 115
        to_port: 115
        protocol: udp
    when:
      event: deployment
```

## License

MIT