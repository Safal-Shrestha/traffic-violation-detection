import type { ViolationsData } from '../types/violations'

export const violationsData: ViolationsData = {
  violations: [
    {
      id: 'a1b2c3d4-e5f6-4789-8123-001122334455',
      camera: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Maitighar Junction North',
      },
      violation_type: {
        code: 'RED_LIGHT',
        name: 'Red Light Jumping',
      },
      occurred_at: '2026-10-05T16:42:18.311Z',
      status: 'PENDING',
      detected_plate_raw: 'बा १ च ४५६७',
      plate_confidence: 0.942,
      vehicle: {
        id: '21111111-1111-4111-8111-111111111111',
        plate_number: 'BA 1 CHA 4567',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'b2c3d4e5-f6a7-4890-8234-112233445566',
      camera: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Putalisadak Junction',
      },
      violation_type: {
        code: 'NO_HELMET',
        name: 'No Helmet',
      },
      occurred_at: '2026-10-05T15:27:41.520Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा २ प ८१२३',
      plate_confidence: 0.891,
      vehicle: {
        id: '22222222-2222-4222-8222-222222222222',
        plate_number: 'BA 2 PA 8123',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'c3d4e5f6-a7b8-4901-8345-223344556677',
      camera: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Koteshwor Junction',
      },
      violation_type: {
        code: 'STOP_LINE',
        name: 'Stop Line Violation',
      },
      occurred_at: '2026-10-05T13:18:07.112Z',
      status: 'PENDING',
      detected_plate_raw: 'बा ३ ख ७६५४',
      plate_confidence: 0.916,
      vehicle: {
        id: '33333333-3333-4333-8333-333333333333',
        plate_number: 'BA 3 KHA 7654',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'd4e5f6a7-b8c9-4012-8456-334455667788',
      camera: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Kalanki Traffic Point',
      },
      violation_type: {
        code: 'SPEEDING',
        name: 'Speeding',
      },
      occurred_at: '2026-10-05T11:54:29.804Z',
      status: 'REJECTED',
      detected_plate_raw: 'बा ४ च २३४५',
      plate_confidence: 0.873,
      vehicle: null,
      vehicle_proposal_status: 'PENDING_ADMIN',
      thumbnail_url: null,
    },

    {
      id: 'e5f6a7b8-c9d0-4123-8567-445566778899',
      camera: {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Maitighar Mandala',
      },
      violation_type: {
        code: 'RED_LIGHT',
        name: 'Red Light Jumping',
      },
      occurred_at: '2026-10-04T16:36:52.441Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा १ ज ६७८९',
      plate_confidence: 0.967,
      vehicle: {
        id: '55555555-5555-4555-8555-555555555555',
        plate_number: 'BA 1 JA 6789',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'f6a7b8c9-d0e1-4234-8678-556677889900',
      camera: {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'New Baneshwor Junction',
      },
      violation_type: {
        code: 'NO_HELMET',
        name: 'No Helmet',
      },
      occurred_at: '2026-10-04T14:22:16.903Z',
      status: 'PENDING',
      detected_plate_raw: 'बा २ प ३४५६',
      plate_confidence: 0.824,
      vehicle: null,
      vehicle_proposal_status: 'PENDING_ADMIN',
      thumbnail_url: null,
    },

    {
      id: '0718293a-4b5c-4678-8901-667788990011',
      camera: {
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Thapathali Junction',
      },
      violation_type: {
        code: 'STOP_LINE',
        name: 'Stop Line Violation',
      },
      occurred_at: '2026-10-04T12:48:33.217Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा ३ च ९८७६',
      plate_confidence: 0.951,
      vehicle: {
        id: '77777777-7777-4777-8777-777777777777',
        plate_number: 'BA 3 CHA 9876',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '18293a4b-5c6d-4789-9012-778899001122',
      camera: {
        id: '88888888-8888-4888-8888-888888888888',
        name: 'Chabahil Junction',
      },
      violation_type: {
        code: 'SPEEDING',
        name: 'Speeding',
      },
      occurred_at: '2026-10-04T10:16:45.631Z',
      status: 'PENDING',
      detected_plate_raw: 'बा ५ ख ५६७८',
      plate_confidence: 0.906,
      vehicle: {
        id: '88888888-8888-4888-8888-888888888888',
        plate_number: 'BA 5 KHA 5678',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '293a4b5c-6d7e-4890-9123-889900112233',
      camera: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Maitighar Junction North',
      },
      violation_type: {
        code: 'RED_LIGHT',
        name: 'Red Light Jumping',
      },
      occurred_at: '2026-10-03T16:51:09.412Z',
      status: 'REJECTED',
      detected_plate_raw: 'बा १ क १२३४',
      plate_confidence: 0.782,
      vehicle: {
        id: '91111111-1111-4111-8111-111111111111',
        plate_number: 'BA 1 KA 1234',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '3a4b5c6d-7e8f-4901-9234-990011223344',
      camera: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Putalisadak Junction',
      },
      violation_type: {
        code: 'NO_HELMET',
        name: 'No Helmet',
      },
      occurred_at: '2026-10-03T15:37:28.708Z',
      status: 'CONFIRMED',
      detected_plate_raw: null,
      plate_confidence: null,
      vehicle: null,
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '4b5c6d7e-8f90-4012-9345-aabbccddeeff',
      camera: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Koteshwor Junction',
      },
      violation_type: {
        code: 'STOP_LINE',
        name: 'Stop Line Violation',
      },
      occurred_at: '2026-10-03T13:04:51.126Z',
      status: 'PENDING',
      detected_plate_raw: 'बा ३ च ४४५५',
      plate_confidence: 0.935,
      vehicle: {
        id: 'a3333333-3333-4333-8333-333333333333',
        plate_number: 'BA 3 CHA 4455',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '5c6d7e8f-9012-4123-9456-bbccddeeff00',
      camera: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Kalanki Traffic Point',
      },
      violation_type: {
        code: 'SPEEDING',
        name: 'Speeding',
      },
      occurred_at: '2026-10-03T11:42:17.534Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा ४ ख ७७८८',
      plate_confidence: 0.914,
      vehicle: {
        id: 'a4444444-4444-4444-8444-444444444444',
        plate_number: 'BA 4 KHA 7788',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '6d7e8f90-1234-4234-9567-ccddeeff0011',
      camera: {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Maitighar Mandala',
      },
      violation_type: {
        code: 'RED_LIGHT',
        name: 'Red Light Jumping',
      },
      occurred_at: '2026-10-02T17:03:42.901Z',
      status: 'PENDING',
      detected_plate_raw: 'बा १ प ८८९९',
      plate_confidence: 0.881,
      vehicle: null,
      vehicle_proposal_status: 'PENDING_ADMIN',
      thumbnail_url: null,
    },

    {
      id: '7e8f9012-3456-4345-9678-ddeeff001122',
      camera: {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'New Baneshwor Junction',
      },
      violation_type: {
        code: 'NO_HELMET',
        name: 'No Helmet',
      },
      occurred_at: '2026-10-02T15:29:11.317Z',
      status: 'REJECTED',
      detected_plate_raw: 'बा २ प ४५६७',
      plate_confidence: 0.861,
      vehicle: {
        id: 'b6666666-6666-4666-8666-666666666666',
        plate_number: 'BA 2 PA 4567',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '8f901234-5678-4456-9789-eeff00112233',
      camera: {
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Thapathali Junction',
      },
      violation_type: {
        code: 'STOP_LINE',
        name: 'Stop Line Violation',
      },
      occurred_at: '2026-10-02T13:47:55.624Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा ३ च २३२३',
      plate_confidence: 0.973,
      vehicle: {
        id: 'b7777777-7777-4777-8777-777777777777',
        plate_number: 'BA 3 CHA 2323',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '90123456-789a-4567-9890-ff0011223344',
      camera: {
        id: '88888888-8888-4888-8888-888888888888',
        name: 'Chabahil Junction',
      },
      violation_type: {
        code: 'SPEEDING',
        name: 'Speeding',
      },
      occurred_at: '2026-10-02T10:31:24.808Z',
      status: 'PENDING',
      detected_plate_raw: 'बा ५ क ६६७७',
      plate_confidence: 0.927,
      vehicle: {
        id: 'b8888888-8888-4888-8888-888888888888',
        plate_number: 'BA 5 KA 6677',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'a1234567-89ab-4678-9012-001122334455',
      camera: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Maitighar Junction North',
      },
      violation_type: {
        code: 'NO_HELMET',
        name: 'No Helmet',
      },
      occurred_at: '2026-10-01T16:18:37.442Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा १ प ३३४४',
      plate_confidence: 0.956,
      vehicle: {
        id: 'c1111111-1111-4111-8111-111111111111',
        plate_number: 'BA 1 PA 3344',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'b2345678-9abc-4789-8123-112233445566',
      camera: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Putalisadak Junction',
      },
      violation_type: {
        code: 'RED_LIGHT',
        name: 'Red Light Jumping',
      },
      occurred_at: '2026-10-01T14:56:03.119Z',
      status: 'PENDING',
      detected_plate_raw: 'बा २ च ९९८८',
      plate_confidence: 0.901,
      vehicle: {
        id: 'c2222222-2222-4222-8222-222222222222',
        plate_number: 'BA 2 CHA 9988',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'c3456789-abcd-4890-8234-223344556677',
      camera: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Koteshwor Junction',
      },
      violation_type: {
        code: 'STOP_LINE',
        name: 'Stop Line Violation',
      },
      occurred_at: '2026-10-01T12:21:48.706Z',
      status: 'REJECTED',
      detected_plate_raw: 'बा ३ ख १२१२',
      plate_confidence: 0.746,
      vehicle: null,
      vehicle_proposal_status: 'PENDING_ADMIN',
      thumbnail_url: null,
    },

    {
      id: 'd456789a-bcde-4901-8345-334455667788',
      camera: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Kalanki Traffic Point',
      },
      violation_type: {
        code: 'SPEEDING',
        name: 'Speeding',
      },
      occurred_at: '2026-09-30T16:44:19.335Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा ४ च ५६५६',
      plate_confidence: 0.948,
      vehicle: {
        id: 'c4444444-4444-4444-8444-444444444444',
        plate_number: 'BA 4 CHA 5656',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'e56789ab-cdef-4012-8456-445566778899',
      camera: {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Maitighar Mandala',
      },
      violation_type: {
        code: 'RED_LIGHT',
        name: 'Red Light Jumping',
      },
      occurred_at: '2026-09-30T14:37:52.513Z',
      status: 'PENDING',
      detected_plate_raw: null,
      plate_confidence: null,
      vehicle: null,
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: 'f6789abc-def0-4123-8567-556677889900',
      camera: {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'New Baneshwor Junction',
      },
      violation_type: {
        code: 'NO_HELMET',
        name: 'No Helmet',
      },
      occurred_at: '2026-09-30T12:15:26.827Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा २ प ७७७७',
      plate_confidence: 0.933,
      vehicle: {
        id: 'c6666666-6666-4666-8666-666666666666',
        plate_number: 'BA 2 PA 7777',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '0789abcd-ef01-4234-8678-667788990011',
      camera: {
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Thapathali Junction',
      },
      violation_type: {
        code: 'STOP_LINE',
        name: 'Stop Line Violation',
      },
      occurred_at: '2026-09-30T10:48:41.209Z',
      status: 'PENDING',
      detected_plate_raw: 'बा ३ प ३४३४',
      plate_confidence: 0.894,
      vehicle: {
        id: 'c7777777-7777-4777-8777-777777777777',
        plate_number: 'BA 3 PA 3434',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '189abcde-f012-4345-9789-778899001122',
      camera: {
        id: '88888888-8888-4888-8888-888888888888',
        name: 'Chabahil Junction',
      },
      violation_type: {
        code: 'SPEEDING',
        name: 'Speeding',
      },
      occurred_at: '2026-09-29T16:02:17.614Z',
      status: 'REJECTED',
      detected_plate_raw: 'बा ५ ख ८८८८',
      plate_confidence: 0.812,
      vehicle: {
        id: 'c8888888-8888-4888-8888-888888888888',
        plate_number: 'BA 5 KHA 8888',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '29abcdef-0123-4456-9890-889900112233',
      camera: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Maitighar Junction North',
      },
      violation_type: {
        code: 'RED_LIGHT',
        name: 'Red Light Jumping',
      },
      occurred_at: '2026-09-29T14:25:39.428Z',
      status: 'CONFIRMED',
      detected_plate_raw: 'बा १ च ९०९०',
      plate_confidence: 0.961,
      vehicle: {
        id: 'd1111111-1111-4111-8111-111111111111',
        plate_number: 'BA 1 CHA 9090',
      },
      vehicle_proposal_status: null,
      thumbnail_url: null,
    },

    {
      id: '3abcdef0-1234-4567-9012-990011223344',
      camera: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Putalisadak Junction',
      },
      violation_type: {
        code: 'NO_HELMET',
        name: 'No Helmet',
      },
      occurred_at: '2026-09-29T11:37:06.853Z',
      status: 'PENDING',
      detected_plate_raw: 'बा २ प २१२१',
      plate_confidence: 0.917,
      vehicle: null,
      vehicle_proposal_status: 'PENDING_ADMIN',
      thumbnail_url: null,
    },
  ],
}